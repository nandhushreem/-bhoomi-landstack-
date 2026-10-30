import React, { useState } from "react";
import {
  FileText,
  Clock,
  CheckCircle2,
  ArrowRight,
  Plus,
  ShieldCheck,
  Download,
  Search,
  AlertTriangle,
} from "lucide-react";
import { post, date, download, terminal } from "./api";
import { Stat, Badge, Empty, Modal } from "./ui";
export default function Requests({
  data,
  user,
  config,
  run,
  reload,
  openAuth,
  navigate,
}) {
  const [review, setReview] = useState(null),
    [filter, setFilter] = useState("All statuses"),
    [query, setQuery] = useState("");
  if (!user)
    return (
      <div className="welcome-card">
        <FileText size={42} />
        <h2>Your land services workspace</h2>
        <p>
          Sign in to keep your requests, or choose a demo department to explore
          the review process.
        </p>
        <div className="button-row">
          <button className="btn" onClick={openAuth}>
            Enter workspace <ArrowRight size={17} />
          </button>
        </div>
      </div>
    );
  const pending = data.apps.filter((a) => !terminal(a.status));
  const filtered = data.apps.filter(
    (a) =>
      (filter === "All statuses" || a.status === filter) &&
      [a.id, a.parcel_id, a.service, a.applicant].some((v) =>
        v?.toLowerCase().includes(query.toLowerCase()),
      ),
  );
  return (
    <>
      <section className="stats-row three">
        <Stat
          label="APPLICATIONS"
          value={data.apps.length}
          note={
            user.role === "officer"
              ? "Scoped to your department and state"
              : "In your citizen workspace"
          }
          icon={FileText}
        />
        <Stat
          label="AWAITING REVIEW"
          value={pending.length}
          note={`${pending.filter((a) => a.overdue).length} past the demo target`}
          icon={Clock}
        />
        <Stat
          label="COMPLETED"
          value={data.apps.length - pending.length}
          note="Recorded outcomes and withdrawals"
          icon={CheckCircle2}
        />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>
              {user.role === "officer"
                ? `${config.departments[user.department] || "Revenue"} queue`
                : "Application tracking"}
            </h3>
            <p>
              {user.role === "officer"
                ? "Only the currently assigned department can take the next decision."
                : "Your tracking reference, review stages and decisions stay together."}
            </p>
          </div>
          {user.role === "citizen" && (
            <button className="btn" onClick={() => navigate("explore")}>
              <Plus size={15} />
              New request
            </button>
          )}
        </div>
        <div className="explorer-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label="Search applications"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tracking reference, parcel or service…"
            />
          </div>
          <select
            aria-label="Application status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option>All statuses</option>
            {[
              "Submitted",
              "Under review",
              "In progress",
              "Approved",
              "Rejected",
              "Withdrawn",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {!filtered.length ? (
          <Empty
            title="No matching applications"
            description="Create a request in citizen mode, or switch to the department assigned to an existing request."
          />
        ) : (
          <div className="application-list">
            {filtered.map((a) => (
              <article className="application-card" key={a.id}>
                <div className="application-top">
                  <div>
                    <span className="eyebrow">{a.id}</span>
                    <h3>{a.service}</h3>
                  </div>
                  <Badge>{a.status}</Badge>
                </div>
                <p className="application-meta">
                  {a.parcel_id} · {config.profiles[a.state]?.name} ·{" "}
                  {date(a.created_at)}
                  {user.role === "officer" && " · " + a.applicant}
                </p>
                <p>{a.details}</p>
                <div className="request-facts">
                  {a.requested_area && (
                    <span>
                      Requested area{" "}
                      <strong>
                        {Number(a.requested_area).toLocaleString("en-IN")} m²
                      </strong>
                    </span>
                  )}
                  {a.payload.new_owner && (
                    <span>
                      Proposed rights holder{" "}
                      <strong>{a.payload.new_owner}</strong>
                    </span>
                  )}
                  {a.payload.proposed_use && (
                    <span>
                      Proposed use <strong>{a.payload.proposed_use}</strong>
                    </span>
                  )}
                  {a.payload.reference && (
                    <span>
                      Evidence reference <strong>{a.payload.reference}</strong>
                    </span>
                  )}
                </div>
                <div className="task-track">
                  {a.tasks.map((t) => (
                    <div
                      className={"task-step " + t.status.toLowerCase()}
                      key={t.id}
                    >
                      <span>
                        {t.status === "Approved" ? (
                          <CheckCircle2 size={16} />
                        ) : t.status === "Pending" ? (
                          <Clock size={16} />
                        ) : (
                          <span className="task-circle" />
                        )}
                      </span>
                      <div>
                        <strong>{config.departments[t.department]}</strong>
                        <small>
                          {t.status}
                          {t.completed_at ? " · " + date(t.completed_at) : ""}
                        </small>
                        {t.reason && <p>{t.reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="request-due">
                  <span className={a.overdue ? "overdue" : ""}>
                    {a.overdue ? (
                      <AlertTriangle size={13} />
                    ) : (
                      <Clock size={13} />
                    )}
                    Demo target: {date(a.due_at)}
                  </span>
                  {!terminal(a.status) && (
                    <span>
                      With {config.departments[a.assigned_department]}
                    </span>
                  )}
                </div>
                {terminal(a.status) && a.reason && (
                  <div className="decision-reason">
                    <strong>Recorded outcome</strong>
                    <p>{a.reason}</p>
                  </div>
                )}
                <div className="card-actions">
                  {a.can_decide && (
                    <button className="btn small" onClick={() => setReview(a)}>
                      Review application <ArrowRight size={15} />
                    </button>
                  )}
                  <button
                    className="btn secondary small"
                    onClick={() =>
                      download(a.id + "-receipt.json", {
                        notice:
                          "Synthetic service receipt; not a government certificate",
                        application: a,
                      })
                    }
                  >
                    <Download size={13} />
                    Receipt
                  </button>
                  {user.role === "citizen" &&
                    ["Submitted", "Under review"].includes(a.status) &&
                    !a.tasks.some((t) => t.status === "Approved") && (
                      <button
                        className="text-button danger"
                        onClick={() =>
                          run(async () => {
                            await post("/applications/" + a.id + "/withdraw");
                            await reload();
                            return "Request withdrawn.";
                          })
                        }
                      >
                        Withdraw request
                      </button>
                    )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {review && (
        <Review
          application={review}
          parcel={data.parcels.find((p) => p.id === review.parcel_id)}
          config={config}
          onClose={() => setReview(null)}
          onSubmit={(body) =>
            run(async () => {
              const r = await post(
                "/applications/" + review.id + "/decision",
                body,
              );
              setReview(null);
              await reload();
              return r.next_department
                ? `Review saved. Next: ${config.departments[r.next_department]}.`
                : "Decision saved with parcel audit history.";
            })
          }
        />
      )}
    </>
  );
}
function Review({ application: a, parcel, config, onClose, onSubmit }) {
  const [saving, setSaving] = useState(false);
  return (
    <Modal title="Review application" onClose={onClose}>
      <div className="form-parcel">
        <ShieldCheck size={20} />
        <div>
          <strong>{a.id}</strong>
          <span>
            {config.departments[a.assigned_department]} · {a.parcel_id}
          </span>
        </div>
      </div>
      <p>{a.details}</p>
      <div className="request-facts">
        {a.requested_area && (
          <span>
            Area{" "}
            <strong>
              {parcel.area} → {a.requested_area} m²
            </strong>
          </span>
        )}
        {a.payload.new_owner && (
          <span>
            Rights holder{" "}
            <strong>
              {parcel.owner} → {a.payload.new_owner}
            </strong>
          </span>
        )}
      </div>
      <p className="form-note">
        Approval completes this department’s task. Any next department receives
        the request automatically.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          const f = new FormData(e.currentTarget);
          await onSubmit({
            decision: f.get("decision"),
            reason: f.get("reason"),
            dispute_reviewed: f.get("dispute_reviewed") === "on",
            acknowledge_restrictions:
              f.get("acknowledge_restrictions") === "on",
          });
          setSaving(false);
        }}
      >
        <label>
          Decision
          <select name="decision">
            <option>Approved</option>
            <option>Rejected</option>
          </select>
        </label>
        <label>
          Reason for decision
          <textarea
            name="reason"
            required
            minLength={10}
            maxLength={1000}
            rows={4}
            placeholder="Explain the evidence reviewed and the demo decision."
          />
        </label>
        {parcel?.disputed && (
          <label className="checkbox-label">
            <input type="checkbox" name="dispute_reviewed" />I reviewed the
            synthetic dispute indicator.
          </label>
        )}
        {a.service === "Building permission" &&
          a.assigned_department === "planning" && (
            <label className="checkbox-label">
              <input type="checkbox" name="acknowledge_restrictions" />I
              reviewed zoning and sample restriction layers.
            </label>
          )}
        <p className="form-note">
          Recorded decisions cannot be edited through this application. No legal
          registration or building authorization is issued.
        </p>
        <button className="btn full" disabled={saving}>
          {saving ? "Saving…" : "Record decision"}
          <ShieldCheck size={16} />
        </button>
      </form>
    </Modal>
  );
}
