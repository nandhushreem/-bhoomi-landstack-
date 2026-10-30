import { Router } from "express";
import { randomBytes } from "node:crypto";
import { pool } from "./db.js";
import { services, canWork } from "./domain.js";
import { recordChecks } from "./seed.js";
export const workflow = Router();
const auth = (req, res, next) =>
  req.user
    ? next()
    : res.status(401).json({ error: "Please sign in to continue" });
const fail = (status, message) => Object.assign(new Error(message), { status });
export async function audit(c, a, user, action, detail) {
  await c.query(
    "INSERT INTO bhoomi.audit(application_id,parcel_id,actor,action,detail) VALUES($1,$2,$3,$4,$5)",
    [a.id, a.parcel_id, user.name, action, detail],
  );
}
async function notify(c, a, title, message) {
  await c.query(
    "INSERT INTO bhoomi.notifications(user_id,application_id,title,message) VALUES($1,$2,$3,$4)",
    [a.user_id, a.id, title, message],
  );
}
workflow.get("/applications", auth, async (req, res) => {
  const values = [],
    where = [];
  if (req.user.role === "citizen") {
    values.push(req.user.id);
    where.push(`a.user_id=$${values.length}`);
  } else if (req.user.department !== "administrator") {
    values.push(req.user.department || "revenue");
    where.push(
      `EXISTS(SELECT 1 FROM bhoomi.tasks z WHERE z.application_id=a.id AND z.department=$${values.length})`,
    );
    if (req.user.jurisdiction && req.user.jurisdiction !== "ALL") {
      values.push(req.user.jurisdiction);
      where.push(`p.data->>'state'=$${values.length}`);
    }
  }
  const { rows } = await pool.query(
    `SELECT a.*,p.data->>'locality' locality,p.data->>'state' state,u.name applicant,COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY stage) FROM bhoomi.tasks t WHERE t.application_id=a.id),'[]') tasks FROM bhoomi.applications a JOIN bhoomi.parcels p ON p.id=a.parcel_id JOIN bhoomi.users u ON u.id=a.user_id ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY a.created_at DESC LIMIT 300`,
    values,
  );
  res.json({
    applications: rows.map((a) => ({
      ...a,
      overdue:
        !["Approved", "Rejected", "Withdrawn"].includes(a.status) &&
        new Date(a.due_at) < new Date(),
      can_decide:
        canWork(req.user, a.assigned_department, a.state) &&
        !["Approved", "Rejected", "Withdrawn"].includes(a.status),
    })),
  });
});
workflow.post("/applications", auth, async (req, res) => {
  if (req.user.role !== "citizen")
    throw fail(403, "Use citizen mode to submit a request");
  const {
      parcel_id,
      service,
      details,
      requested_area,
      new_owner,
      proposed_use,
      reference,
    } = req.body,
    config = Object.hasOwn(services, service) ? services[service] : null;
  if (
    !config ||
    typeof details !== "string" ||
    details.trim().length < 10 ||
    details.length > 2000
  )
    throw fail(
      400,
      "Choose a service and provide 10–2000 characters of supporting details",
    );
  const area = service === "Area correction" ? Number(requested_area) : null;
  if (
    service === "Area correction" &&
    (!Number.isFinite(area) || area <= 0 || area > 10000000)
  )
    throw fail(400, "Enter a valid area in square metres");
  if (
    service === "Registration & mutation" &&
    (typeof new_owner !== "string" ||
      new_owner.trim().length < 2 ||
      new_owner.length > 100)
  )
    throw fail(400, "Provide the new synthetic rights-holder name");
  if (
    service === "Building permission" &&
    ![
      "Residential",
      "Commercial",
      "Mixed use",
      "Public use",
      "Agricultural",
    ].includes(proposed_use)
  )
    throw fail(400, "Choose a proposed land use");
  if (
    reference != null &&
    (typeof reference !== "string" || reference.length > 100)
  )
    throw fail(400, "Evidence reference must be at most 100 characters");
  const payload = {
    new_owner: service === "Registration & mutation" ? new_owner.trim() : null,
    proposed_use: service === "Building permission" ? proposed_use : null,
    reference: reference?.trim() || null,
  };
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await c.query(
      "SELECT data FROM bhoomi.parcels WHERE id=$1 FOR SHARE",
      [parcel_id],
    );
    const p = result.rows[0]?.data;
    if (!p) throw fail(404, "Parcel not found");
    const recent = await c.query(
      "SELECT id FROM bhoomi.applications WHERE user_id=$1 AND parcel_id=$2 AND service=$3 AND details=$4 AND created_at>now()-interval '20 seconds'",
      [req.user.id, parcel_id, service, details.trim()],
    );
    if (recent.rows.length)
      throw fail(
        409,
        "This request was just submitted. Check My applications before trying again.",
      );
    const id = "BHM-" + randomBytes(5).toString("hex").toUpperCase(),
      status = p.disputed ? "Under review" : "Submitted";
    const { rows } = await c.query(
      "INSERT INTO bhoomi.applications(id,parcel_id,user_id,service,requested_area,details,status,parcel_version,payload,due_at,assigned_department) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+($10::int*interval '1 day'),$11) RETURNING *",
      [
        id,
        p.id,
        req.user.id,
        service,
        area,
        details.trim(),
        status,
        p.version,
        payload,
        config.days,
        config.departments[0],
      ],
    );
    const a = rows[0];
    for (let i = 0; i < config.departments.length; i++)
      await c.query(
        "INSERT INTO bhoomi.tasks(application_id,stage,department,status) VALUES($1,$2,$3,$4)",
        [id, i, config.departments[i], i === 0 ? "Pending" : "Waiting"],
      );
    await audit(c, a, req.user, "Application submitted", {
      service,
      status,
      checks: recordChecks(p).map((v) => v.code),
      stages: config.departments,
    });
    await notify(
      c,
      a,
      "Request received",
      `${service} is with ${config.departments[0]}. Your tracking reference is ${id}.`,
    );
    await c.query("COMMIT");
    res.status(201).json({ application: a });
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
});
workflow.post("/applications/:id/decision", auth, async (req, res) => {
  const { decision, reason, dispute_reviewed, acknowledge_restrictions } =
    req.body;
  if (
    !["Approved", "Rejected"].includes(decision) ||
    typeof reason !== "string" ||
    reason.trim().length < 10 ||
    reason.length > 1000
  )
    throw fail(400, "Provide a decision and a reason of 10–1000 characters");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await c.query(
      "SELECT * FROM bhoomi.applications WHERE id=$1 FOR UPDATE",
      [req.params.id],
    );
    const a = result.rows[0];
    if (!a) throw fail(404, "Application not found");
    const parcel = await c.query(
      "SELECT data FROM bhoomi.parcels WHERE id=$1 FOR UPDATE",
      [a.parcel_id],
    );
    const p = parcel.rows[0].data;
    if (!canWork(req.user, a.assigned_department, p.state))
      throw fail(
        403,
        "This task belongs to another department or state. Switch to the assigned demo department.",
      );
    if (["Approved", "Rejected"].includes(a.status))
      throw fail(409, "This application has already been decided");
    const tr = await c.query(
      "SELECT * FROM bhoomi.tasks WHERE application_id=$1 AND status='Pending' ORDER BY stage LIMIT 1 FOR UPDATE",
      [a.id],
    );
    const task = tr.rows[0];
    if (!task) throw fail(409, "No pending review task");
    if (decision === "Approved" && p.disputed && dispute_reviewed !== true)
      throw fail(
        409,
        "Acknowledge that the demo dispute was reviewed before approving",
      );
    if (decision === "Approved" && p.version !== a.parcel_version)
      throw fail(
        409,
        "Parcel changed since submission. Reject this request and ask for a fresh application.",
      );
    if (
      decision === "Approved" &&
      task.department === "planning" &&
      p.zone === "Conservation"
    )
      throw fail(
        409,
        "The sample conservation designation prevents demo building approval. Record a rejection with a reason.",
      );
    if (
      decision === "Approved" &&
      a.service === "Building permission" &&
      task.department === "planning" &&
      acknowledge_restrictions !== true
    )
      throw fail(
        400,
        "Confirm the planning and restriction review before approving",
      );
    const before = {
      area: p.area,
      owner: p.owner,
      version: p.version,
      disputed: p.disputed,
      permission: p.permission,
    };
    let changed = false;
    if (decision === "Approved") {
      if (a.service === "Area correction") {
        p.area = Number(a.requested_area);
        changed = true;
      }
      if (
        a.service === "Registration & mutation" &&
        task.department === "revenue"
      ) {
        p.owner = a.payload.new_owner;
        p.registered_at = new Date().toISOString().slice(0, 10);
        changed = true;
      }
      if (a.service === "Dispute report") {
        p.disputed = true;
        changed = true;
      }
      if (a.service === "Dispute resolution") {
        p.disputed = false;
        changed = true;
      }
      if (
        a.service === "Building permission" &&
        task.department === "planning"
      ) {
        p.permission = "Demo planning review approved";
        changed = true;
      }
    }
    if (changed) {
      p.version++;
      p.source_updated = new Date().toISOString().slice(0, 10);
      await c.query("UPDATE bhoomi.parcels SET data=$2 WHERE id=$1", [p.id, p]);
      await c.query(
        "UPDATE bhoomi.applications SET parcel_version=$2 WHERE id=$1",
        [a.id, p.version],
      );
    }
    await c.query(
      "UPDATE bhoomi.tasks SET status=$2,reason=$3,actor=$4,completed_at=now() WHERE id=$1",
      [task.id, decision, reason.trim(), req.user.name],
    );
    const next =
      decision === "Approved"
        ? (
            await c.query(
              "SELECT * FROM bhoomi.tasks WHERE application_id=$1 AND status='Waiting' ORDER BY stage LIMIT 1",
              [a.id],
            )
          ).rows[0]
        : null;
    const status =
      decision === "Rejected" ? "Rejected" : next ? "In progress" : "Approved";
    if (next)
      await c.query("UPDATE bhoomi.tasks SET status='Pending' WHERE id=$1", [
        next.id,
      ]);
    if (decision === "Rejected")
      await c.query(
        "UPDATE bhoomi.tasks SET status='Cancelled' WHERE application_id=$1 AND status='Waiting'",
        [a.id],
      );
    await c.query(
      "UPDATE bhoomi.applications SET status=$2,reason=$3,assigned_department=$4,updated_at=now() WHERE id=$1",
      [a.id, status, reason.trim(), next?.department || task.department],
    );
    await audit(
      c,
      a,
      req.user,
      status === "Approved" || status === "Rejected"
        ? status
        : "Department review completed",
      {
        reason: reason.trim(),
        department: task.department,
        next_department: next?.department || null,
        before,
        after: {
          area: p.area,
          owner: p.owner,
          version: p.version,
          disputed: p.disputed,
          permission: p.permission,
        },
        dispute_reviewed: dispute_reviewed === true,
      },
    );
    if (decision === "Approved")
      await c.query(
        "INSERT INTO bhoomi.integration_events(event_key,application_id,parcel_id,department,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
        [
          `${a.id}:${task.stage}`,
          a.id,
          p.id,
          task.department,
          {
            service: a.service,
            parcel_version: p.version,
            source: "Simulated departmental API",
            values: {
              owner:
                a.service === "Registration & mutation" &&
                task.department === "registration"
                  ? a.payload.new_owner
                  : p.owner,
              area: p.area,
              permission: p.permission,
              tax_due: p.tax_due,
              zone: p.zone,
            },
          },
        ],
      );
    await notify(
      c,
      a,
      status === "In progress"
        ? "Request moved to next department"
        : `Request ${status.toLowerCase()}`,
      next
        ? `${task.department} completed review. Your request is now with ${next.department}.`
        : `${a.service}: ${reason.trim()}`,
    );
    await c.query("COMMIT");
    res.json({ ok: true, status, next_department: next?.department || null });
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
});
workflow.post("/applications/:id/withdraw", auth, async (req, res) => {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await c.query(
      "SELECT * FROM bhoomi.applications WHERE id=$1 FOR UPDATE",
      [req.params.id],
    );
    const a = r.rows[0];
    if (!a || a.user_id !== req.user.id)
      throw fail(404, "Your application was not found");
    if (!["Submitted", "Under review"].includes(a.status))
      throw fail(
        409,
        "Only requests awaiting their first review can be withdrawn",
      );
    const complete = await c.query(
      "SELECT id FROM bhoomi.tasks WHERE application_id=$1 AND status='Approved'",
      [a.id],
    );
    if (complete.rows.length)
      throw fail(409, "A department has already acted on this request");
    await c.query(
      "UPDATE bhoomi.applications SET status='Withdrawn',reason='Withdrawn by applicant',updated_at=now() WHERE id=$1",
      [a.id],
    );
    await c.query(
      "UPDATE bhoomi.tasks SET status='Cancelled' WHERE application_id=$1",
      [a.id],
    );
    await audit(c, a, req.user, "Withdrawn", {
      reason: "Withdrawn by applicant",
    });
    await c.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
});
workflow.get("/notifications", auth, async (req, res) =>
  res.json({
    notifications: (
      await pool.query(
        "SELECT * FROM bhoomi.notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 60",
        [req.user.id],
      )
    ).rows,
  }),
);
workflow.post("/notifications/read", auth, async (req, res) => {
  await pool.query(
    "UPDATE bhoomi.notifications SET read=true WHERE user_id=$1",
    [req.user.id],
  );
  res.json({ ok: true });
});
workflow.get("/bookmarks", auth, async (req, res) =>
  res.json({
    bookmarks: (
      await pool.query(
        "SELECT parcel_id FROM bhoomi.bookmarks WHERE user_id=$1 ORDER BY created_at DESC",
        [req.user.id],
      )
    ).rows.map((r) => r.parcel_id),
  }),
);
workflow.post("/bookmarks/:id", auth, async (req, res) => {
  if (typeof req.body.saved !== "boolean")
    throw fail(400, "Specify saved as true or false");
  const exists = await pool.query("SELECT id FROM bhoomi.parcels WHERE id=$1", [
    req.params.id,
  ]);
  if (!exists.rows.length) throw fail(404, "Parcel not found");
  if (req.body.saved)
    await pool.query(
      "INSERT INTO bhoomi.bookmarks(user_id,parcel_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [req.user.id, req.params.id],
    );
  else
    await pool.query(
      "DELETE FROM bhoomi.bookmarks WHERE user_id=$1 AND parcel_id=$2",
      [req.user.id, req.params.id],
    );
  res.json({ ok: true });
});
