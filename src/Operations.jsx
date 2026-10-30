import React, { useEffect, useState } from "react";
import {
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Database,
  PlugZap,
} from "lucide-react";
import { api, post, date, download } from "./api";
import { Badge, Empty } from "./ui";
export function DataExchange({ user, config, run, reload, openAuth }) {
  const [state, setState] = useState("TN"),
    [text, setText] = useState(""),
    [preview, setPreview] = useState(null),
    [batches, setBatches] = useState([]),
    [working, setWorking] = useState(false);
  const admin = user?.department === "administrator";
  const loadBatches = () =>
    admin && api("/exchange/batches").then((j) => setBatches(j.batches));
  useEffect(() => {
    if (admin) loadBatches();
  }, [admin]);
  const edit = (v) => {
    setText(v);
    setPreview(null);
  };
  async function template() {
    await run(async () => {
      const t = await api("/exchange/template/" + state);
      edit(JSON.stringify(t, null, 2));
    });
  }
  if (!admin)
    return (
      <div className="welcome-card">
        <Database size={42} />
        <h2>Connect a department dataset</h2>
        <p>
          Import new synthetic parcel records using state-specific field names
          and units. This workspace is available in the Platform administrator
          demo.
        </p>
        <div className="button-row">
          <button className="btn" onClick={openAuth}>
            Choose administrator demo <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  return (
    <>
      <div className="operation-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Dataset import</h3>
              <p>
                Validate first. Import once. Existing parcels are never
                overwritten.
              </p>
            </div>
            <Upload size={20} />
          </div>
          <div className="operation-content">
            <div className="input-row">
              <label>
                State adapter
                <select
                  aria-label="Import state adapter"
                  value={state}
                  onChange={(e) => {
                    setState(e.target.value);
                    setPreview(null);
                  }}
                >
                  {Object.entries(config.profiles).map(([k, p]) => (
                    <option key={k} value={k}>
                      {p.name} · {p.areaUnit}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn secondary" onClick={template}>
                Load sample template
              </button>
            </div>
            <label className="file-upload">
              <Upload size={16} />
              Open JSON file
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) =>
                  run(async () => {
                    const f = e.target.files[0];
                    if (!f) return;
                    if (f.size > 900000)
                      throw new Error("Use a JSON file below 900 KB.");
                    edit(await f.text());
                  })
                }
              />
            </label>
            <label className="editor-label">
              Source payload
              <textarea
                className="json-editor"
                aria-label="Source dataset JSON"
                value={text}
                spellCheck={false}
                onChange={(e) => edit(e.target.value)}
                placeholder="Load a sample template or open a JSON file."
                rows={17}
              />
            </label>
            <div className="button-row left">
              <button
                className="btn secondary"
                disabled={!text || working}
                onClick={() =>
                  run(async () => {
                    setWorking(true);
                    try {
                      const payload = JSON.parse(text);
                      if (payload.state !== state)
                        throw new Error(
                          "Payload state must match the selected adapter.",
                        );
                      setPreview(await post("/exchange/preview", payload));
                    } finally {
                      setWorking(false);
                    }
                  })
                }
              >
                <ShieldCheck size={16} />
                Validate & preview
              </button>
              <button
                className="btn"
                disabled={!preview?.valid || working}
                onClick={() =>
                  run(async () => {
                    setWorking(true);
                    try {
                      const r = await post(
                        "/exchange/import",
                        JSON.parse(text),
                      );
                      setPreview(null);
                      edit("");
                      await reload();
                      await loadBatches();
                      return `${r.imported} new parcel record imported.`;
                    } finally {
                      setWorking(false);
                    }
                  })
                }
              >
                <Upload size={16} />
                Import dataset
              </button>
              <button
                className="text-button"
                disabled={!text}
                onClick={() =>
                  download("bhoomi-" + state + "-sample.json", text)
                }
              >
                Download JSON
              </button>
            </div>
          </div>
        </section>
        <aside>
          <section className="panel">
            <div className="panel-heading">
              <h3>How normalization works</h3>
            </div>
            <div className="standards">
              <p>
                <strong>1. State fields</strong>
                <br />
                Each adapter maps local identifiers, survey references and
                rights-holder names into a common schema.
              </p>
              <p>
                <strong>2. Area conversion</strong>
                <br />
                Tamil Nadu: hectares × 10,000.
                <br />
                Andhra Pradesh: acres × 4,046.8564224.
                <br />
                Karnataka: square metres.
              </p>
              <p>
                <strong>3. Validation</strong>
                <br />
                Required fields, units, duplicate identifiers and structurally
                valid GeoJSON rings are checked. At most 200 rows per batch.
              </p>
              <p>
                <strong>4. Transactional import</strong>
                <br />
                The full batch is committed together. Invalid rows prevent the
                import.
              </p>
              <div className="check-card">
                <AlertTriangle size={16} />
                <p>
                  These are configurable demonstration formats, not official
                  state API schemas. Use synthetic records only.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
      {preview && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>
                {preview.valid
                  ? "Validation passed"
                  : "Dataset needs correction"}
              </h3>
              <p>
                {preview.normalized.length} normalized rows · canonical unit m²
              </p>
            </div>
            {preview.valid ? (
              <CheckCircle2 color="#548456" />
            ) : (
              <AlertTriangle color="#ad7652" />
            )}
          </div>
          {preview.errors.length > 0 && (
            <div className="validation-errors">
              {preview.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>PARCEL</th>
                  <th>RIGHTS HOLDER</th>
                  <th>AREA (m²)</th>
                  <th>LAND USE</th>
                  <th>STATE</th>
                </tr>
              </thead>
              <tbody>
                {preview.normalized.slice(0, 20).map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.owner}</td>
                    <td>{p.area}</td>
                    <td>{p.zone}</td>
                    <td>{p.state_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Import history</h3>
            <p>Committed dataset batches and their source names</p>
          </div>
        </div>
        {batches.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SOURCE</th>
                  <th>STATE</th>
                  <th>RECORDS</th>
                  <th>IMPORTED</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td>{b.source}</td>
                    <td>{config.profiles[b.state]?.name}</td>
                    <td>{b.count}</td>
                    <td>{date(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No imports yet"
            description="Load a template, validate it, and import your first synthetic dataset."
          />
        )}
      </section>
    </>
  );
}
export function Integrations({ user, config, run, openAuth }) {
  const [events, setEvents] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const admin = user?.department === "administrator";
  async function load() {
    try {
      const j = await api("/integrations");
      setEvents(j.events);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (user?.role === "officer") load();
    else setLoading(false);
  }, [user?.id]);
  if (user?.role !== "officer")
    return (
      <div className="welcome-card">
        <PlugZap size={42} />
        <h2>See departments stay in sync</h2>
        <p>
          Approved review stages create reliable delivery events. Officers can
          view their department; the administrator can simulate outages and
          retry delivery.
        </p>
        <div className="button-row">
          <button className="btn" onClick={openAuth}>
            Choose a department demo <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  const process = (id, fail = false) =>
    run(async () => {
      setBusy(true);
      try {
        const r = await post("/integrations/process", {
          event_id: id,
          simulate_failure: fail,
        });
        await load();
        return fail
          ? "Simulated outage recorded. Retry to recover the event."
          : `${r.processed.length} event delivery processed.`;
      } finally {
        setBusy(false);
      }
    });
  return (
    <>
      <div className="sync-banner">
        <span className="large-icon">
          <PlugZap size={28} />
        </span>
        <div>
          <h3>Durable delivery, visible recovery.</h3>
          <p>
            Local mock departmental APIs. No requests are sent to government
            systems.
          </p>
          <div className="sync-counts">
            <span>
              {events.filter((e) => e.status === "Pending").length} pending
            </span>
            <span>
              {events.filter((e) => e.status === "Failed").length} failed
            </span>
            <span>
              {events.filter((e) => e.status === "Delivered").length} delivered
            </span>
          </div>
        </div>
        <button
          className="btn secondary"
          disabled={busy}
          onClick={() => run(load)}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
        {admin && (
          <button
            className="btn"
            disabled={busy || !events.some((e) => e.status !== "Delivered")}
            onClick={() => process()}
          >
            <CheckCircle2 size={15} />
            Process pending
          </button>
        )}
      </div>
      {error && <p className="inline-error">{error}</p>}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Department delivery log</h3>
            <p>
              Events are unique per review stage. Successful deliveries are not
              replayed.
            </p>
          </div>
        </div>
        {loading ? (
          <p className="operation-content">Loading integration events…</p>
        ) : !events.length ? (
          <Empty
            title="No delivery events yet"
            description="Approve a citizen request to generate a department event."
          />
        ) : (
          <div className="event-list">
            {events.map((e) => (
              <article className="event-card" key={e.id}>
                <div>
                  <span className="eyebrow">
                    {config.departments[e.department]} ADAPTER
                  </span>
                  <h3>{e.payload.service}</h3>
                  <p>
                    {e.parcel_id} · {e.application_id}
                  </p>
                  <small>
                    {date(e.created_at)} · {e.attempts} delivery attempts
                  </small>
                  {e.last_error && (
                    <p className="inline-error">{e.last_error}</p>
                  )}
                </div>
                <Badge>{e.status}</Badge>
                {admin && e.status !== "Delivered" && (
                  <div className="card-actions">
                    <button
                      className="btn small"
                      disabled={busy}
                      onClick={() => process(e.id)}
                    >
                      {e.status === "Failed"
                        ? "Retry delivery"
                        : "Deliver event"}
                    </button>
                    <button
                      className="btn secondary small"
                      disabled={busy}
                      onClick={() => process(e.id, true)}
                    >
                      Simulate outage
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <div className="demo-notice">
        <ShieldCheck size={16} />
        <span>
          Deliveries update the corresponding local source record. Failures
          remain stored and can be retried; parcel decisions stay committed.
        </span>
      </div>
    </>
  );
}
