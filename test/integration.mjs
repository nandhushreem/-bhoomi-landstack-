import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db.js";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const users = [],
  parcels = [],
  batches = [];
let checkCount = 0;
function client() {
  let cookie = "";
  return async (path, body, expected = 200) => {
    const r = await fetch(
      base + (path.startsWith("/ogc") ? "" : "/api") + path,
      {
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    if (r.headers.get("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    const j = await r.json();
    assert.equal(r.status, expected, JSON.stringify(j));
    checkCount++;
    return j;
  };
}
const citizen = client(),
  other = client(),
  registration = client(),
  revenue = client(),
  fiscal = client(),
  planning = client(),
  admin = client(),
  wrongState = client(),
  anon = client();
async function demo(c, department, jurisdiction = "TN") {
  const j = await c("/auth/demo", {
    role: department ? "officer" : "citizen",
    department,
    jurisdiction,
  });
  users.push(j.user.id);
}
const decision = (c, id, extra = {}, status = 200) =>
  c(
    "/applications/" + id + "/decision",
    {
      decision: "Approved",
      reason: "Synthetic verification reviewed the sample evidence",
      ...extra,
    },
    status,
  );
try {
  assert.equal((await anon("/health")).version, "2.1.0");
  assert.equal(Object.keys((await anon("/configuration")).profiles).length, 3);
  assert.ok((await anon("/parcels")).parcels.length >= 180);
  await anon("/applications", undefined, 401);
  const email = "test-" + randomUUID() + "@example.invalid",
    password = "Test-" + randomUUID();
  users.push(
    (
      await citizen(
        "/auth/register",
        { name: "Integration Test Citizen", email, password },
        201,
      )
    ).user.id,
  );
  await citizen("/auth/logout", {});
  await citizen("/auth/login", { email, password });
  await demo(other);
  await demo(registration, "registration");
  await demo(revenue, "revenue");
  await demo(fiscal, "fiscal");
  await demo(planning, "planning");
  await demo(admin, "administrator", "ALL");
  await demo(wrongState, "revenue", "KA");
  const template = await anon("/exchange/template/TN");
  const id = "DEMO-TN-TEST-" + Date.now();
  template.records[0].parcel_ref = id;
  template.source = "Synthetic automated verification";
  const preview = await admin("/exchange/preview", template);
  assert.equal(preview.valid, true);
  assert.equal(preview.normalized[0].area, 1200);
  await citizen("/exchange/import", template, 403);
  const imported = await admin("/exchange/import", template, 201);
  parcels.push(id);
  batches.push(imported.batch);
  await admin("/exchange/import", template, 400);
  const invalid = structuredClone(template);
  invalid.records[0].extent_ha = -1;
  assert.equal((await admin("/exchange/preview", invalid)).valid, false);
  const feature = await anon("/ogc/collections/parcels/items/" + id);
  assert.equal(feature.properties.area, 1200);
  const features = await anon(
    "/ogc/collections/parcels/items?state=TN&limit=2",
  );
  assert.equal(features.numberReturned, 2);
  assert.ok(features.links.some((l) => l.rel === "next"));
  await anon("/ogc/collections/parcels/items?bbox=bad", undefined, 400);
  await citizen("/bookmarks/" + id, { saved: true });
  assert.ok((await citizen("/bookmarks")).bookmarks.includes(id));
  assert.equal((await other("/bookmarks")).bookmarks.length, 0);
  const make = async (service, extra = {}) =>
    (
      await citizen(
        "/applications",
        {
          parcel_id: id,
          service,
          details: "Synthetic integration verification " + randomUUID(),
          ...extra,
        },
        201,
      )
    ).application;
  const a = await make("Registration & mutation", {
    new_owner: "Sample Updated Holder",
    reference: "SAMPLE-DEED-001",
  });
  assert.equal(
    (await other("/applications")).applications.some((v) => v.id === a.id),
    false,
  );
  await decision(citizen, a.id, {}, 403);
  await decision(revenue, a.id, {}, 403);
  assert.equal((await decision(registration, a.id)).next_department, "revenue");
  assert.equal(
    (await anon("/ogc/collections/parcels/items/" + id)).properties.owner,
    "Sample Citizen",
  );
  await decision(wrongState, a.id, {}, 403);
  assert.equal((await decision(revenue, a.id)).next_department, "fiscal");
  assert.equal(
    (await anon("/ogc/collections/parcels/items/" + id)).properties.owner,
    "Sample Updated Holder",
  );
  assert.equal((await decision(fiscal, a.id)).status, "Approved");
  await decision(fiscal, a.id, {}, 409);
  const mine = (await citizen("/applications")).applications.find(
    (v) => v.id === a.id,
  );
  assert.equal(mine.tasks.length, 3);
  assert.ok(mine.tasks.every((t) => t.status === "Approved"));
  assert.ok((await citizen("/notifications")).notifications.length >= 4);
  await citizen("/notifications/read", {});
  assert.ok(
    (await citizen("/notifications")).notifications.every((n) => n.read),
  );
  const events = (await admin("/integrations")).events.filter(
    (e) => e.application_id === a.id,
  );
  assert.equal(events.length, 3);
  await citizen("/integrations", undefined, 403);
  await revenue("/integrations/process", {}, 403);
  await admin("/integrations/process", {
    event_id: events[0].id,
    simulate_failure: true,
  });
  assert.equal(
    (await admin("/integrations")).events.find((e) => e.id === events[0].id)
      .status,
    "Failed",
  );
  for (const e of events)
    await admin("/integrations/process", { event_id: e.id });
  assert.equal(
    (await admin("/integrations/process", { event_id: events[0].id })).processed
      .length,
    0,
  );
  const rights = (await anon("/parcels/" + id + "/records")).records.find(
    (r) => r.domain === "rights",
  );
  assert.equal(rights.values.owner, "Sample Updated Holder");
  const building = await make("Building permission", {
    proposed_use: "Residential",
  });
  await decision(planning, building.id, {}, 400);
  await decision(planning, building.id, { acknowledge_restrictions: true });
  await decision(fiscal, building.id);
  const correction1 = await make("Area correction", { requested_area: 1300 }),
    correction2 = await make("Area correction", { requested_area: 1400 });
  await decision(revenue, correction1.id);
  await decision(revenue, correction2.id, {}, 409);
  await decision(revenue, correction2.id, { decision: "Rejected" });
  const dispute = await make("Dispute report");
  await decision(revenue, dispute.id);
  assert.equal(
    (await anon("/ogc/collections/parcels/items/" + id)).properties.disputed,
    true,
  );
  const enquiry = await make("Ownership record enquiry");
  assert.equal(enquiry.status, "Under review");
  await decision(revenue, enquiry.id, {}, 409);
  await decision(revenue, enquiry.id, { decision: "Rejected" });
  const resolution = await make("Dispute resolution");
  await decision(revenue, resolution.id, { dispute_reviewed: true });
  assert.equal(
    (await anon("/ogc/collections/parcels/items/" + id)).properties.disputed,
    false,
  );
  const withdrawn = await make("Tax assessment review");
  await citizen("/applications/" + withdrawn.id + "/withdraw", {});
  assert.equal(
    (await citizen("/applications")).applications.find(
      (v) => v.id === withdrawn.id,
    ).status,
    "Withdrawn",
  );
  await decision(fiscal, withdrawn.id, {}, 409);
  assert.ok((await anon("/parcels/" + id + "/history")).events.length >= 10);
  assert.ok((await anon("/quality")).issues.length > 0);
  assert.ok((await anon("/parcels/" + id + "/spatial")).geometry_area > 0);
  await citizen("/auth/logout", {});
  await citizen("/auth/login", { email, password });
  assert.ok(
    (await citizen("/applications")).applications.some((v) => v.id === a.id),
  );
  console.log(
    `PASS: ${checkCount} HTTP checks — multi-state import/units, citizen privacy, roles/jurisdiction, three-department mutation, planning, dispute, version conflict, withdrawal, notifications, bookmarks, durable failure/retry, GeoJSON pagination and persistence.`,
  );
} finally {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    if (parcels.length) {
      const refs = parcels;
      await c.query(
        "DELETE FROM bhoomi.notifications WHERE application_id IN (SELECT id FROM bhoomi.applications WHERE parcel_id=ANY($1::text[]))",
        [refs],
      );
      await c.query(
        "DELETE FROM bhoomi.integration_events WHERE parcel_id=ANY($1::text[])",
        [refs],
      );
      await c.query(
        "DELETE FROM bhoomi.tasks WHERE application_id IN (SELECT id FROM bhoomi.applications WHERE parcel_id=ANY($1::text[]))",
        [refs],
      );
      await c.query(
        "DELETE FROM bhoomi.audit WHERE parcel_id=ANY($1::text[])",
        [refs],
      );
      await c.query(
        "DELETE FROM bhoomi.bookmarks WHERE parcel_id=ANY($1::text[])",
        [refs],
      );
      await c.query(
        "DELETE FROM bhoomi.applications WHERE parcel_id=ANY($1::text[])",
        [refs],
      );
      await c.query(
        "DELETE FROM bhoomi.source_records WHERE parcel_id=ANY($1::text[])",
        [refs],
      );
      await c.query("DELETE FROM bhoomi.parcels WHERE id=ANY($1::text[])", [
        refs,
      ]);
    }
    if (batches.length)
      await c.query(
        "DELETE FROM bhoomi.import_batches WHERE id=ANY($1::uuid[])",
        [batches],
      );
    if (users.length) {
      await c.query(
        "DELETE FROM bhoomi.sessions WHERE user_id=ANY($1::uuid[])",
        [users],
      );
      await c.query("DELETE FROM bhoomi.users WHERE id=ANY($1::uuid[])", [
        users,
      ]);
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}
