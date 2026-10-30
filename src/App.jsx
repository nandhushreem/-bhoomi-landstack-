import React, { useEffect, useState, lazy, Suspense } from "react";
import {
  Layers,
  Map,
  FileText,
  LayoutDashboard,
  Database,
  PlugZap,
  BookOpen,
  Activity,
  ChevronRight,
  Menu,
  ArrowUpRight,
  ArrowRight,
  LogOut,
  X,
  Info,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Bell,
  ShieldCheck,
  MapPin,
} from "lucide-react";
import { api, post, date } from "./api";
import { Modal } from "./ui";
const Explorer = lazy(() => import("./Explorer"));
const Requests = lazy(() => import("./Requests"));
const Insights = lazy(() => import("./Insights"));
const DataExchange = lazy(() =>
  import("./Operations").then((m) => ({ default: m.DataExchange })),
);
const Integrations = lazy(() =>
  import("./Operations").then((m) => ({ default: m.Integrations })),
);
const Guide = lazy(() => import("./Guide"));
const pages = {
  explore: {
    name: "Parcel explorer",
    title: "Know your land.",
    sub: "Explore connected records and services across three state pilots.",
    eyebrow: "ONE PARCEL. A CONNECTED PICTURE.",
    icon: Map,
  },
  applications: {
    name: "My applications",
    title: "Your requests, in view.",
    sub: "Follow every review, handoff and decision in one place.",
    eyebrow: "TRANSPARENT SERVICES, EVERY STEP.",
    icon: FileText,
  },
  insights: {
    name: "Governance insights",
    title: "A clearer view of governance.",
    sub: "Compare source records and inspect governance outcomes.",
    eyebrow: "FROM RECORDS TO BETTER DECISIONS.",
    icon: LayoutDashboard,
  },
  exchange: {
    name: "Data exchange",
    title: "Different records. Common ground.",
    sub: "Validate and normalize state datasets without losing their context.",
    eyebrow: "INTEROPERABILITY THAT YOU CAN SEE.",
    icon: Database,
  },
  integrations: {
    name: "Department sync",
    title: "Keep every department connected.",
    sub: "Inspect delivery events, simulate failures and recover safely.",
    eyebrow: "RELIABLE HANDOFFS. VISIBLE RECOVERY.",
    icon: PlugZap,
  },
  guide: {
    name: "How to use Bhoomi",
    title: "A simple guide to Bhoomi.",
    sub: "From your first search to a complete project demonstration.",
    eyebrow: "EVERY ROLE. EVERY STEP.",
    icon: BookOpen,
  },
  about: {
    name: "Platform & standards",
    title: "Connected records. Clear standards.",
    sub: "Understand what is implemented, simulated and planned for production.",
    eyebrow: "OPEN BY DESIGN.",
    icon: Activity,
  },
};
const initialView = () =>
  pages[location.hash.slice(1)] ? location.hash.slice(1) : "explore";
export default function App() {
  const [view, setView] = useState(initialView),
    [data, setData] = useState({
      parcels: [],
      analytics: null,
      apps: [],
      notifications: [],
    }),
    [config, setConfig] = useState(null),
    [user, setUser] = useState(null),
    [auth, setAuth] = useState(false),
    [mobile, setMobile] = useState(false),
    [toast, setToast] = useState(null),
    [error, setError] = useState(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [inbox, setInbox] = useState(false),
    [focusParcel, setFocusParcel] = useState(null);
  async function reload() {
    const [p, a, m, c] = await Promise.all([
      api("/parcels"),
      api("/analytics"),
      api("/auth/me"),
      api("/configuration"),
    ]);
    let apps = [],
      notifications = [];
    if (m.user) {
      const [r, n] = await Promise.all([
        api("/applications"),
        api("/notifications"),
      ]);
      apps = r.applications;
      notifications = n.notifications;
    }
    setConfig(c);
    setUser(m.user);
    setData({ parcels: p.parcels, analytics: a, apps, notifications });
    setError(null);
  }
  useEffect(() => {
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    const hash = () => setView(initialView());
    window.addEventListener("hashchange", hash);
    return () => window.removeEventListener("hashchange", hash);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  function navigate(v) {
    setView(v);
    location.hash = v;
    setMobile(false);
    setInbox(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function run(fn) {
    setBusy(true);
    try {
      const result = await fn();
      if (typeof result === "string") setToast({ text: result });
      return result;
    } catch (e) {
      setToast({ text: e.message, error: true });
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function enter(role, department = "revenue", jurisdiction = "ALL") {
    await run(async () => {
      if (user) await post("/auth/logout");
      await post("/auth/demo", { role, department, jurisdiction });
      await reload();
      setAuth(false);
      navigate(role === "officer" ? "applications" : "explore");
      return `You’re in ${role} demo mode. All data is synthetic.`;
    });
  }
  function openParcel(id) {
    setFocusParcel(id);
    navigate("explore");
  }
  const unread = data.notifications.filter((n) => !n.read).length,
    pending = data.apps.filter(
      (a) => !["Approved", "Rejected", "Withdrawn"].includes(a.status),
    ).length;
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "is-open" : "")}>
        <a
          className="brand"
          href="#explore"
          onClick={() => navigate("explore")}
        >
          <span className="brand-mark">
            <Layers size={25} />
          </span>
          <span>
            bhoomi<span className="brand-caption">LAND STACK</span>
          </span>
        </a>
        <div className="workspace-label">
          WORKSPACE <span className="version-chip">2.0</span>
        </div>
        <nav>
          {Object.entries(pages).map(([key, p]) => {
            const Icon = p.icon;
            return (
              <button
                key={key}
                className={"nav-item " + (view === key ? "active" : "")}
                onClick={() => navigate(key)}
              >
                <Icon size={18} />
                <span>
                  {key === "applications" && user?.role === "officer"
                    ? "Service queue"
                    : p.name}
                </span>
                {key === "applications" && pending > 0 && (
                  <small>{pending}</small>
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-project">
          <span className="eyebrow">CONNECTED GOVERNANCE</span>
          <div className="connection">
            <i />
            Land records & registration
          </div>
          <div className="connection">
            <i />
            Planning, disputes & taxation
          </div>
          <p>
            3 state adapters · 6 pilot areas
            <br />
            Synthetic data · mock integrations
          </p>
        </div>
        <div className="sidebar-bottom">
          <div className="pilot">
            <span className="pilot-dot" />
            SIH26014 · Functional prototype
          </div>
          <p>
            Built around every parcel.
            <br />
            Designed for everyone.
          </p>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span>Land governance</span>
            <ChevronRight size={14} />
            <strong>{pages[view].name}</strong>
          </div>
          <div className="top-actions">
            <span className="demo-chip">
              <span />
              DEMO ENVIRONMENT
            </span>
            {user ? (
              <>
                <div className="notification-anchor">
                  <button
                    className="icon-btn notification-button"
                    title="Notifications"
                    onClick={() => setInbox(!inbox)}
                  >
                    <Bell size={18} />
                    {unread > 0 && <i>{unread}</i>}
                  </button>
                  {inbox && (
                    <div className="notification-panel">
                      <div>
                        <strong>Notifications</strong>
                        <button
                          className="text-button"
                          onClick={() =>
                            run(async () => {
                              await post("/notifications/read");
                              await reload();
                            })
                          }
                        >
                          Mark read
                        </button>
                      </div>
                      {data.notifications.length ? (
                        data.notifications.slice(0, 12).map((n) => (
                          <article
                            key={n.id}
                            className={n.read ? "" : "unread"}
                          >
                            <strong>{n.title}</strong>
                            <p>{n.message}</p>
                            <small>{date(n.created_at)}</small>
                          </article>
                        ))
                      ) : (
                        <p className="muted">
                          Request updates will appear here.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="user-chip workspace-switch"
                  title="Switch workspace"
                  onClick={() => setAuth(true)}
                >
                  <span className="avatar">
                    {user.role === "officer"
                      ? "DO"
                      : user.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span>
                    {user.name}
                    <small>
                      {user.role === "officer"
                        ? `${config?.profiles[user.jurisdiction]?.name || "All states"} · Switch workspace`
                        : "Citizen · Switch workspace"}
                    </small>
                  </span>
                </button>
                <button
                  className="icon-btn"
                  title="Sign out"
                  onClick={() =>
                    run(async () => {
                      await post("/auth/logout");
                      await reload();
                      return "Signed out successfully.";
                    })
                  }
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <button className="btn small" onClick={() => setAuth(true)}>
                Enter workspace <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">{pages[view].eyebrow}</div>
              <h1>
                {view === "applications" && user?.role === "officer"
                  ? "Service review queue."
                  : pages[view].title}
              </h1>
              <p>{pages[view].sub}</p>
            </div>
            <div className="heading-actions">
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await reload();
                    return "Workspace refreshed.";
                  })
                }
              >
                <RefreshCw size={15} />
                Refresh
              </button>
            </div>
          </div>
          <div className="demo-notice">
            <Info size={15} />
            <span>
              <strong>Explore safely.</strong> Records and parcel overlays are
              synthetic. This app does not verify legal title or process
              government transactions.
            </span>
          </div>
          {error ? (
            <div className="error-box">
              <AlertTriangle />
              <div>
                <h3>We couldn’t load the workspace</h3>
                <p>{error}</p>
                <button className="btn" onClick={() => run(reload)}>
                  Try again
                </button>
              </div>
            </div>
          ) : loading || !config ? (
            <div className="loading">
              <RefreshCw className="spin" />
              Connecting land records…
            </div>
          ) : (
            <>
              <Suspense
                fallback={<div className="loading">Loading workspace…</div>}
              >
                {view === "explore" && (
                  <Explorer
                    data={data}
                    config={config}
                    user={user}
                    run={run}
                    reload={reload}
                    openAuth={() => setAuth(true)}
                    onNavigate={navigate}
                    initialParcel={focusParcel}
                  />
                )}
                {view === "applications" && (
                  <Requests
                    data={data}
                    config={config}
                    user={user}
                    run={run}
                    reload={reload}
                    openAuth={() => setAuth(true)}
                    navigate={navigate}
                  />
                )}
                {view === "insights" && (
                  <Insights
                    data={data}
                    config={config}
                    run={run}
                    openParcel={openParcel}
                  />
                )}
                {view === "exchange" && (
                  <DataExchange
                    user={user}
                    config={config}
                    run={run}
                    reload={reload}
                    openAuth={() => setAuth(true)}
                  />
                )}
                {view === "integrations" && (
                  <Integrations
                    user={user}
                    config={config}
                    run={run}
                    openAuth={() => setAuth(true)}
                  />
                )}
                {view === "guide" && <Guide navigate={navigate} />}
                {view === "about" && <About navigate={navigate} />}
              </Suspense>
            </>
          )}
          <footer className="page-footer">
            <span>
              <Layers size={14} />
              Bhoomi Land Stack · v2
            </span>
            <span>
              SIH26014 · Synthetic demonstration · No official affiliation
            </span>
            <button onClick={() => navigate("guide")}>
              How to use Bhoomi <ArrowUpRight size={13} />
            </button>
          </footer>
        </main>
      </div>
      {auth && config && (
        <Access
          config={config}
          busy={busy}
          onClose={() => setAuth(false)}
          enter={enter}
          submit={(mode, body) =>
            run(async () => {
              await post("/auth/" + mode, body);
              await reload();
              setAuth(false);
              navigate("applications");
              return "Your citizen workspace is ready.";
            })
          }
        />
      )}
      {toast && (
        <div className={"toast " + (toast.error ? "error" : "")} role="status">
          {toast.error ? (
            <AlertTriangle size={19} />
          ) : (
            <CheckCircle2 size={19} />
          )}
          <span>{toast.text}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function Access({ config, busy, onClose, enter, submit }) {
  const [mode, setMode] = useState("login"),
    [department, setDepartment] = useState("revenue"),
    [state, setState] = useState("ALL");
  return (
    <Modal title="Choose your workspace" onClose={onClose}>
      <p className="muted">
        Try the demo workflow, or sign in to keep your citizen requests.
      </p>
      <div className="demo-choices">
        <button onClick={() => enter("citizen")} disabled={busy}>
          <MapPin />
          <strong>Citizen demo</strong>
          <span>Explore records and submit requests</span>
          <ArrowRight size={17} />
        </button>
        <button
          onClick={() => enter("officer", department, state)}
          disabled={busy}
        >
          <ShieldCheck />
          <strong>Officer demo</strong>
          <span>Enter the selected department below</span>
          <ArrowRight size={17} />
        </button>
      </div>
      <div className="demo-department">
        <label>
          Demo department
          <select
            aria-label="Demo department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            {Object.entries(config.departments).map(([key, name]) => (
              <option value={key} key={key}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Jurisdiction
          <select
            aria-label="Demo jurisdiction"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="ALL">All states</option>
            {Object.entries(config.profiles).map(([key, p]) => (
              <option value={key} key={key}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="form-note">
        Public demo officers can change synthetic records only.
      </p>
      <div className="auth-divider">OR USE A CITIZEN ACCOUNT</div>
      <div className="auth-tabs">
        <button
          className={mode === "login" ? "active" : ""}
          onClick={() => setMode("login")}
        >
          Sign in
        </button>
        <button
          className={mode === "register" ? "active" : ""}
          onClick={() => setMode("register")}
        >
          Create account
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(mode, Object.fromEntries(new FormData(e.currentTarget)));
        }}
      >
        {mode === "register" && (
          <label>
            Name
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
            />
          </label>
        )}
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            maxLength={200}
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 10 : 1}
            maxLength={128}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />
        </label>
        {mode === "register" && (
          <p className="form-note">
            At least 10 characters. Use a test email; avoid sensitive personal
            information.
          </p>
        )}
        <button className="btn full" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create citizen account"}
          <ArrowRight size={16} />
        </button>
      </form>
    </Modal>
  );
}
function About({ navigate }) {
  return (
    <>
      <div className="about-hero">
        <span className="eyebrow">BHOOMI / SIH26014 / VERSION 2</span>
        <h2>
          One spatial foundation.
          <br />A connected governance journey.
        </h2>
        <p>
          Parcel records, departmental reviews, configurable state adapters,
          source reconciliation and citizen services.
        </p>
        <div className="button-row left">
          <button className="btn light" onClick={() => navigate("guide")}>
            Open the user guide <ArrowRight size={16} />
          </button>
          <a
            className="btn ghost"
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
          >
            API specification <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
      <div className="about-grid">
        {[
          [
            "01",
            "Parcel foundation",
            "Urban and rural pilots in three states. Search, bookmarks, source records, map overlays and GeoJSON export.",
          ],
          [
            "02",
            "Department workflows",
            "Registration, revenue, fiscal, planning and dispute reviews. Department and jurisdiction checks are enforced by the server.",
          ],
          [
            "03",
            "Interoperable data",
            "State-specific fields and area units normalize into a shared schema. Source comparison keeps conflicting values visible.",
          ],
          [
            "04",
            "Reliable operations",
            "Atomic decisions, parcel versions, persistent delivery events, outage simulation and idempotent retry.",
          ],
        ].map(([n, title, text]) => (
          <div className="panel about-card" key={n}>
            <span>{n}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h3>Open interfaces and honest boundaries</h3>
        </div>
        <div className="standards">
          <p>
            <strong>Feature service:</strong>{" "}
            <a href="/ogc" target="_blank" rel="noreferrer">
              Discovery
            </a>{" "}
            ·{" "}
            <a
              href="/ogc/collections/parcels/items?limit=5"
              target="_blank"
              rel="noreferrer"
            >
              Sample GeoJSON
            </a>
            . Experimental OGC-style discovery, bounding-box and pagination
            routes. No formal conformance or certification claim.
          </p>
          <p>
            <strong>Data exchange:</strong> three demonstration state formats
            with square-metre, hectare and acre conversion. These are
            configurable samples, not official government schemas.
          </p>
          <p>
            <strong>Spatial analysis:</strong> intersections with synthetic
            utility and restriction overlays. Recorded area, illustrative
            geometry area and sample valuation remain distinct.
          </p>
          <p>
            <strong>Data quality:</strong> deterministic source comparisons. No
            trained AI, fraud verdict, satellite change detection or predictive
            accuracy claim.
          </p>
          <p>
            <strong>Security:</strong> hashed passwords and sessions, production
            cookie protections, server-side department/state permissions,
            validation, rate limits, transaction locks and audit history. Public
            officer demo access is intentional.
          </p>
          <p>
            <strong>Production boundaries:</strong> no legal title verification,
            real ULPIN issuance, government connectors, document uploads, actual
            registrations, payments or legally valid building approvals. Real
            rollout requires verified identities, authorized records/connectors,
            approved state rules and independent validation.
          </p>
          <p>
            <a
              href="https://github.com/nandhushreem/-bhoomi-landstack-/blob/main/TECHNICAL.md"
              target="_blank"
              rel="noreferrer"
            >
              Standard Technical Document
            </a>{" "}
            ·{" "}
            <a
              href="https://github.com/nandhushreem/-bhoomi-landstack-"
              target="_blank"
              rel="noreferrer"
            >
              Source repository
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
