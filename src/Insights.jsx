import React, { useEffect, useState } from "react";
import {
  Layers,
  AlertTriangle,
  Activity,
  Building2,
  ChevronRight,
  Download,
  ShieldCheck,
} from "lucide-react";
import { api, money, zoneColors, download } from "./api";
import { Stat, Badge, Empty } from "./ui";
export default function Insights({ data, config, run, openParcel }) {
  const [quality, setQuality] = useState(null),
    [filter, setFilter] = useState("ALL"),
    [code, setCode] = useState("ALL");
  useEffect(() => {
    api("/quality")
      .then(setQuality)
      .catch((e) =>
        run(async () => {
          throw e;
        }),
      );
  }, [data.parcels]);
  const parcels = data.parcels.filter(
      (p) => filter === "ALL" || p.state === filter,
    ),
    issues = (quality?.issues || []).filter(
      (i) =>
        (filter === "ALL" || i.state === filter) &&
        (code === "ALL" || i.code === code),
    );
  const tax = parcels.reduce((n, p) => n + Number(p.tax_due), 0);
  const zoneStats = Object.keys(zoneColors).map((z) => [
    z,
    parcels.filter((p) => p.zone === z).length,
  ]);
  return (
    <>
      <div className="view-filters">
        <select
          aria-label="Insights state"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">All state pilots</option>
          {Object.entries(config.profiles).map(([s, p]) => (
            <option key={s} value={s}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          className="btn secondary"
          onClick={() =>
            download("bhoomi-quality-report.json", {
              notice: quality?.method,
              generated_at: new Date().toISOString(),
              issues,
            })
          }
        >
          <Download size={15} />
          Export quality report
        </button>
      </div>
      <section className="stats-row">
        <Stat
          label="CONNECTED PARCELS"
          value={parcels.length}
          note="Source-linked sample records"
          icon={Layers}
        />
        <Stat
          label="DISPUTE FLAGS"
          value={parcels.filter((p) => p.disputed).length}
          note="Require a human review"
          icon={AlertTriangle}
        />
        <Stat
          label="SAMPLE TAX DUES"
          value={money(tax)}
          note="Illustrative fiscal data"
          icon={Building2}
        />
        <Stat
          label="QUALITY FINDINGS"
          value={quality ? issues.length : "…"}
          note="Sources compared transparently"
          icon={Activity}
        />
      </section>
      <div className="insight-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Land use distribution</h3>
              <p>Parcel counts in the selected state scope</p>
            </div>
          </div>
          <div className="bars">
            {zoneStats.map(([z, n]) => (
              <div className="bar-row" key={z}>
                <span>
                  <i style={{ background: zoneColors[z] }} />
                  {z}
                </span>
                <div>
                  <i
                    style={{
                      width: (n / Math.max(parcels.length, 1)) * 100 + "%",
                      background: zoneColors[z],
                    }}
                  />
                </div>
                <strong>{n}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Service outcomes</h3>
              <p>All-state application counts from PostgreSQL</p>
            </div>
          </div>
          <div className="outcomes">
            {[
              "Submitted",
              "Under review",
              "In progress",
              "Approved",
              "Rejected",
              "Withdrawn",
            ].map((s) => (
              <div key={s}>
                <Badge>{s}</Badge>
                <strong>
                  {data.analytics.applications.find((a) => a.status === s)
                    ?.count || 0}
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Explainable data quality</h3>
            <p>{quality?.method || "Loading source comparisons…"}</p>
          </div>
          <select
            aria-label="Quality rule"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          >
            <option value="ALL">All checks</option>
            {[...new Set((quality?.issues || []).map((i) => i.code))].map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
        </div>
        <div className="attention-list">
          {issues.slice(0, 150).map((i, n) => (
            <button
              key={i.parcel_id + i.code + n}
              onClick={() => openParcel(i.parcel_id)}
            >
              <span className="attention-icon">
                <AlertTriangle size={18} />
              </span>
              <span>
                <strong>
                  {i.parcel_id} · {i.title}
                </strong>
                <small>{i.detail}</small>
              </span>
              <Badge>{i.severity}</Badge>
              <ChevronRight size={17} />
            </button>
          ))}
          {quality && !issues.length && (
            <Empty
              title="No findings in this filter"
              description="Try a different state or rule."
            />
          )}
        </div>
      </section>
      <div className="demo-notice">
        <ShieldCheck size={16} />
        <span>
          Record mismatch detection is rule-based. It never changes
          authoritative-looking values automatically or declares ownership,
          fraud or legal title.
        </span>
      </div>
    </>
  );
}
