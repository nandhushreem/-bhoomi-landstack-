import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  Layers,
  MapPin,
  ArrowUpRight,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Bookmark,
  Printer,
  FileText,
} from "lucide-react";
import MapView from "./MapView";
import { api, post, money, date, zoneColors, download } from "./api";
import { Badge, Record, Empty, Modal, Stat } from "./ui";
export default function Explorer({
  data,
  user,
  config,
  run,
  reload,
  openAuth,
  onNavigate,
  initialParcel,
}) {
  const [state, setState] = useState("KA"),
    [context, setContext] = useState("Urban"),
    [zone, setZone] = useState("All land uses"),
    [query, setQuery] = useState(""),
    [layer, setLayer] = useState("Land use"),
    [selected, setSelected] = useState(null),
    [tab, setTab] = useState("Overview"),
    [history, setHistory] = useState([]),
    [records, setRecords] = useState([]),
    [spatial, setSpatial] = useState(null),
    [overlayData, setOverlayData] = useState([]),
    [overlays, setOverlays] = useState({ restriction: false, utility: false }),
    [request, setRequest] = useState(null),
    [saved, setSaved] = useState([]),
    [onlySaved, setOnlySaved] = useState(false),
    [detailError, setDetailError] = useState(null);
  useEffect(() => {
    api("/layers")
      .then((j) => setOverlayData(j.features))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (user)
      api("/bookmarks")
        .then((j) => setSaved(j.bookmarks))
        .catch(() => setSaved([]));
    else setSaved([]);
  }, [user?.id]);
  useEffect(() => {
    if (initialParcel) {
      const p = data.parcels.find((p) => p.id === initialParcel);
      if (p) {
        setState(p.state);
        setContext(p.context);
        setSelected(p);
      }
    }
  }, [initialParcel]);
  useEffect(() => {
    if (selected) {
      const p = data.parcels.find((p) => p.id === selected.id);
      if (p) setSelected(p);
    }
  }, [data.parcels]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setDetailError(null);
    Promise.all([
      api("/parcels/" + selected.id + "/history"),
      api("/parcels/" + selected.id + "/records"),
      api("/parcels/" + selected.id + "/spatial"),
    ])
      .then(([h, r, s]) => {
        if (active) {
          setHistory(h.events);
          setRecords(r.records);
          setSpatial(s);
        }
      })
      .catch((e) => active && setDetailError(e.message));
    return () => {
      active = false;
    };
  }, [selected?.id, selected?.version, tab]);
  const filtered = useMemo(
    () =>
      data.parcels.filter(
        (p) =>
          (state === "ALL" || p.state === state) &&
          (context === "All areas" || p.context === context) &&
          (zone === "All land uses" || p.zone === zone) &&
          (!onlySaved || saved.includes(p.id)) &&
          (!query ||
            [p.id, p.survey_no, p.demo_identifier, p.owner, p.locality].some(
              (v) => v?.toLowerCase().includes(query.toLowerCase()),
            )),
      ),
    [data.parcels, state, context, zone, query, onlySaved, saved],
  );
  const extras = useMemo(
    () =>
      overlayData.filter(
        (f) =>
          (state === "ALL" || f.properties.state === state) &&
          (context === "All areas" || f.properties.context === context),
      ),
    [overlayData, state, context],
  );
  function choose(p) {
    setSelected(p);
    setTab("Overview");
  }
  function filter(fn, value) {
    fn(value);
    setSelected(null);
  }
  const pilotCount = new Set(
    data.parcels.map((p) => p.state + ":" + p.locality),
  ).size;
  return (
    <>
      <section className="stats-row">
        <Stat
          label="CONNECTED PARCELS"
          value={data.parcels.length}
          note="Three configurable state pilots"
          icon={Layers}
        />
        <Stat
          label="LINKED SOURCE RECORDS"
          value={data.parcels.length * 4}
          note="Rights · registration · planning · fiscal"
          icon={ShieldCheck}
        />
        <Stat
          label="REVIEW INDICATORS"
          value={data.analytics?.checks}
          note="Explainable record checks"
          icon={AlertTriangle}
        />
        <Stat
          label="PILOT LOCATIONS"
          value={String(pilotCount).padStart(2, "0")}
          note="Urban wards and rural villages"
          icon={MapPin}
        />
      </section>
      <section className="explorer">
        <div className="explorer-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              aria-label="Search parcels"
              placeholder="Search parcel, survey number or rights holder…"
              value={query}
              onChange={(e) => filter(setQuery, e.target.value)}
            />
            {query && (
              <button
                className="icon-btn"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <select
            aria-label="State pilot"
            value={state}
            onChange={(e) => filter(setState, e.target.value)}
          >
            {Object.entries(config.profiles).map(([k, p]) => (
              <option value={k} key={k}>
                {p.name}
              </option>
            ))}
            <option value="ALL">All states</option>
          </select>
          <select
            aria-label="Pilot area"
            value={context}
            onChange={(e) => filter(setContext, e.target.value)}
          >
            <option>Urban</option>
            <option>Rural</option>
            <option>All areas</option>
          </select>
          <select
            aria-label="Land use filter"
            value={zone}
            onChange={(e) => filter(setZone, e.target.value)}
          >
            <option>All land uses</option>
            {Object.keys(zoneColors).map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </div>
        <div className="explorer-subtoolbar">
          <div className="overlay-toggles">
            <label>
              <input
                type="checkbox"
                checked={overlays.restriction}
                onChange={(e) =>
                  setOverlays({ ...overlays, restriction: e.target.checked })
                }
              />
              Restriction zones
            </label>
            <label>
              <input
                type="checkbox"
                checked={overlays.utility}
                onChange={(e) =>
                  setOverlays({ ...overlays, utility: e.target.checked })
                }
              />
              Utility corridors
            </label>
            <label>
              <input
                type="checkbox"
                checked={onlySaved}
                onChange={(e) => {
                  setOnlySaved(e.target.checked);
                  setSelected(null);
                }}
              />
              Saved parcels {saved.length > 0 && `(${saved.length})`}
            </label>
          </div>
          <button
            className="text-button"
            onClick={() =>
              download("bhoomi-parcels.geojson", {
                type: "FeatureCollection",
                features: filtered.map(({ geometry, ...p }) => ({
                  type: "Feature",
                  id: p.id,
                  geometry,
                  properties: p,
                })),
              })
            }
          >
            Export GeoJSON <ArrowUpRight size={13} />
          </button>
        </div>
        <div className={"explorer-body " + (selected ? "has-detail" : "")}>
          <div className="map-wrap">
            <MapView
              parcels={filtered}
              selected={selected}
              onSelect={choose}
              layer={layer}
              overlays={extras}
              visibleOverlays={overlays}
            />
            <div className="map-title">
              <span className="live-dot" />
              <div>
                <strong>
                  {state === "ALL"
                    ? "All state pilots"
                    : config.profiles[state]?.name}{" "}
                  · {context}
                </strong>
                <small>Synthetic parcels · WGS84</small>
              </div>
            </div>
            <div className="layer-switch">
              <Layers size={15} />
              <select
                aria-label="Map layer"
                value={layer}
                onChange={(e) => setLayer(e.target.value)}
              >
                <option>Land use</option>
                <option>Risk indicators</option>
              </select>
            </div>
            <div className="map-count">{filtered.length} parcels in view</div>
            <div className="map-legend">
              {layer === "Land use" ? (
                Object.entries(zoneColors)
                  .filter(([z]) => filtered.some((p) => p.zone === z))
                  .map(([z, c]) => (
                    <span key={z}>
                      <i style={{ background: c }} />
                      {z}
                    </span>
                  ))
              ) : (
                <>
                  <span>
                    <i style={{ background: "#c36b59" }} />
                    Dispute
                  </span>
                  <span>
                    <i style={{ background: "#cea95c" }} />
                    Tax due
                  </span>
                  <span>
                    <i style={{ background: "#6d9c85" }} />
                    No flags
                  </span>
                </>
              )}
            </div>
          </div>
          {selected && (
            <aside className="parcel-detail">
              <div className="detail-heading">
                <div>
                  <span className="eyebrow">PARCEL INFORMATION</span>
                  <h2>{selected.id}</h2>
                  <p>
                    {selected.locality} · {selected.state_name}
                  </p>
                </div>
                <button
                  className="icon-btn"
                  aria-label="Close parcel information"
                  onClick={() => setSelected(null)}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="detail-status">
                <Badge>
                  {selected.disputed ? "Under review" : "Record linked"}
                </Badge>
                <span>Version {selected.version}</span>
                <button
                  className="icon-btn"
                  title={
                    saved.includes(selected.id)
                      ? "Unsave parcel"
                      : "Save parcel"
                  }
                  onClick={() =>
                    user
                      ? run(async () => {
                          const add = !saved.includes(selected.id);
                          await post("/bookmarks/" + selected.id, {
                            saved: add,
                          });
                          setSaved(
                            add
                              ? [...saved, selected.id]
                              : saved.filter((id) => id !== selected.id),
                          );
                        })
                      : openAuth()
                  }
                >
                  <Bookmark
                    size={15}
                    fill={saved.includes(selected.id) ? "currentColor" : "none"}
                  />
                </button>
              </div>
              <div className="detail-tabs">
                {["Overview", "Records", "Spatial", "History"].map((t) => (
                  <button
                    key={t}
                    className={t === tab ? "active" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="detail-content">
                {detailError && <p className="inline-error">{detailError}</p>}
                {tab === "Overview" ? (
                  <>
                    <div className="area-card">
                      <span>RECORDED PARCEL AREA</span>
                      <strong>
                        {Number(selected.area).toLocaleString("en-IN")}{" "}
                        <small>m²</small>
                      </strong>
                      <p>
                        <MapPin size={13} />
                        {selected.context} · {selected.zone}
                      </p>
                    </div>
                    <dl className="record-list">
                      <Record
                        label="Recorded rights holder"
                        value={selected.owner}
                      />
                      <Record
                        label="Survey number"
                        value={selected.survey_no}
                      />
                      <Record
                        label="Demo identifier"
                        value={selected.demo_identifier}
                      />
                      <Record
                        label="Property tax"
                        value={
                          selected.tax_due
                            ? money(selected.tax_due) + " due"
                            : "No sample dues"
                        }
                      />
                      <Record
                        label="Building permission"
                        value={selected.permission}
                      />
                      <Record label="Updated" value={selected.source_updated} />
                    </dl>
                    <h4>
                      Record checks <span>{selected.checks.length}</span>
                    </h4>
                    {selected.checks.length ? (
                      selected.checks.map((c) => (
                        <div
                          className={"check-card " + c.severity}
                          key={c.code}
                        >
                          <AlertTriangle size={16} />
                          <div>
                            <strong>{c.title}</strong>
                            <p>{c.detail}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="clear-check">
                        <CheckCircle2 size={16} />
                        No rule-based indicators
                      </div>
                    )}
                  </>
                ) : tab === "Records" ? (
                  <>
                    <p className="muted">
                      Independent department records retain their source and
                      update time. Conflicts remain visible until reviewed and
                      synchronized.
                    </p>
                    {records.map((r) => (
                      <div className="source-record" key={r.id}>
                        <div className="source-title">
                          <strong>
                            {r.domain === "rights"
                              ? "Record of Rights"
                              : r.domain[0].toUpperCase() + r.domain.slice(1)}
                          </strong>
                          <Badge>{r.department}</Badge>
                        </div>
                        {Object.entries(r.values)
                          .filter(([k]) => !k.startsWith("_"))
                          .map(([k, v]) => (
                            <p key={k}>
                              <span className="muted">
                                {k.replaceAll("_", " ")}:{" "}
                              </span>
                              {String(v ?? "—")}
                            </p>
                          ))}
                        {r.values.area != null &&
                          Number(r.values.area) !== Number(selected.area) && (
                            <div className="check-card high">
                              <AlertTriangle size={14} />
                              <p>
                                Source area differs from the current parcel
                                record.
                              </p>
                            </div>
                          )}
                        <small>
                          {r.source} · {date(r.updated_at)}
                        </small>
                      </div>
                    ))}
                  </>
                ) : tab === "Spatial" ? (
                  <>
                    {spatial && (
                      <>
                        <dl className="record-list">
                          <Record
                            label="Illustrative geometry area"
                            value={
                              spatial.geometry_area.toLocaleString("en-IN") +
                              " m²"
                            }
                          />
                          <Record
                            label="Recorded area"
                            value={selected.area + " m²"}
                          />
                          <Record
                            label="Sample valuation reference"
                            value={money(spatial.valuation_reference)}
                          />
                          <Record
                            label="Illustrative rate"
                            value={money(spatial.valuation_rate) + "/m²"}
                          />
                        </dl>
                        <p className="muted">{spatial.notice}</p>
                        <h4>Spatial layer intersections</h4>
                        {spatial.intersections.length ? (
                          spatial.intersections.map((s) => (
                            <div className="source-record" key={s.id}>
                              <strong>{s.name}</strong>
                              <p>
                                {s.kind === "restriction"
                                  ? "Environmental review required in this synthetic zone."
                                  : "Sample utility corridor intersects or touches the parcel."}
                              </p>
                              <small>{s.source}</small>
                            </div>
                          ))
                        ) : (
                          <div className="clear-check">
                            <CheckCircle2 size={16} />
                            No sample overlay intersections
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : history.length ? (
                  history.map((h) => (
                    <div className="timeline-item" key={h.id}>
                      <i className="timeline-dot" />
                      <strong>{h.action}</strong>
                      <p>
                        {h.detail.reason || h.detail.service || h.detail.source}
                      </p>
                      <small>
                        {h.actor} · {date(h.created_at)}
                      </small>
                      {h.detail.before && (
                        <p>
                          Record version {h.detail.before.version} →{" "}
                          {h.detail.after.version}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <Empty
                    title="No changes yet"
                    description="Applications, decisions and import events appear here."
                  />
                )}
              </div>
              <div className="detail-footer">
                <span>
                  <ShieldCheck size={13} />
                  Synthetic data · not a title certificate
                </span>
                <button
                  className="btn"
                  onClick={() =>
                    user?.role === "citizen" ? setRequest(selected) : openAuth()
                  }
                >
                  Request a service <ArrowRight size={16} />
                </button>
                <button
                  className="text-button print-summary"
                  onClick={() => {
                    download(`${selected.id}-summary.json`, {
                      notice:
                        "Synthetic demonstration; not a legal certificate",
                      parcel: selected,
                      source_records: records,
                      spatial,
                    });
                  }}
                >
                  <FileText size={13} />
                  Download parcel summary
                </button>
              </div>
            </aside>
          )}
        </div>
        <div className="parcel-table-heading">
          <div>
            <h3>
              Parcel directory <span>{filtered.length}</span>
            </h3>
            <p>Select a parcel to inspect all its records.</p>
          </div>
          <span className="subtle-label">SYNTHETIC DATASET</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>PARCEL / SURVEY</th>
                <th>RECORDED RIGHTS HOLDER</th>
                <th>LAND USE</th>
                <th>AREA</th>
                <th>RECORD STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className={selected?.id === p.id ? "selected" : ""}
                  onClick={() => choose(p)}
                >
                  <td>
                    <button className="text-button" onClick={() => choose(p)}>
                      {p.id}
                    </button>
                    <small>{p.survey_no}</small>
                  </td>
                  <td>{p.owner}</td>
                  <td>
                    <span className="land-use">
                      <i style={{ background: zoneColors[p.zone] }} />
                      {p.zone}
                    </span>
                  </td>
                  <td>{Number(p.area).toLocaleString("en-IN")} m²</td>
                  <td>
                    <Badge>
                      {p.disputed ? "Under review" : "Record linked"}
                    </Badge>
                  </td>
                  <td>
                    <ArrowUpRight size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <Empty
              title="No matching parcels"
              description="Try a different filter or save a parcel first."
            />
          )}
        </div>
      </section>
      {request && (
        <RequestForm
          parcel={request}
          config={config}
          onClose={() => setRequest(null)}
          onSubmit={(body) =>
            run(async () => {
              const j = await post("/applications", {
                ...body,
                parcel_id: request.id,
              });
              setRequest(null);
              await reload();
              onNavigate("applications");
              return "Request submitted · " + j.application.id;
            })
          }
        />
      )}
    </>
  );
}
function RequestForm({ parcel, config, onClose, onSubmit }) {
  const [service, setService] = useState("Area correction"),
    [saving, setSaving] = useState(false);
  return (
    <Modal title="Request a land service" onClose={onClose}>
      <div className="form-parcel">
        <MapPin size={20} />
        <div>
          <strong>{parcel.id}</strong>
          <span>
            {parcel.locality} · {parcel.area} m²
          </span>
        </div>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          const f = Object.fromEntries(new FormData(e.currentTarget));
          await onSubmit(f);
          setSaving(false);
        }}
      >
        <label>
          Service
          <select
            name="service"
            value={service}
            onChange={(e) => setService(e.target.value)}
          >
            {Object.keys(config.services).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <div className="workflow-preview">
          {config.services[service].departments.map((d, i) => (
            <React.Fragment key={d}>
              {i > 0 && <ArrowRight size={13} />}
              <span>{config.departments[d]}</span>
            </React.Fragment>
          ))}
        </div>
        <p className="form-note">
          {config.services[service].description} Demo target:{" "}
          {config.services[service].days} days.
        </p>
        {service === "Area correction" && (
          <label>
            Requested area (m²)
            <input
              name="requested_area"
              type="number"
              min=".01"
              max="10000000"
              step=".01"
              defaultValue={parcel.area}
              required
            />
          </label>
        )}
        {service === "Registration & mutation" && (
          <label>
            New synthetic rights holder
            <input
              name="new_owner"
              required
              minLength={2}
              maxLength={100}
              placeholder="Sample Citizen"
            />
          </label>
        )}
        {service === "Building permission" && (
          <label>
            Proposed use
            <select name="proposed_use">
              {Object.keys(zoneColors)
                .filter((z) => z !== "Conservation")
                .map((z) => (
                  <option key={z}>{z}</option>
                ))}
            </select>
          </label>
        )}
        <label>
          Evidence / document reference (optional)
          <input
            name="reference"
            maxLength={100}
            placeholder="Example: SAMPLE-DEED-2026-001"
          />
        </label>
        <label>
          Supporting details
          <textarea
            name="details"
            required
            minLength={10}
            maxLength={2000}
            rows={4}
            placeholder="Describe your request using demonstration information only."
          />
        </label>
        {parcel.disputed && (
          <div className="check-card high">
            <AlertTriangle size={16} />
            <p>
              This parcel is flagged for dispute review. Every approval requires
              explicit review acknowledgement.
            </p>
          </div>
        )}
        <p className="form-note">
          This is a simulated service. A document reference is not a verified
          upload. No government submission or payment is made.
        </p>
        <button className="btn full" disabled={saving}>
          {saving ? "Submitting…" : "Submit request"}
          <ArrowRight size={16} />
        </button>
      </form>
    </Modal>
  );
}
