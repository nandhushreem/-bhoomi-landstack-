import React, { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
  BookOpen,
  X,
  CheckCircle2,
} from "lucide-react";
import { api, post } from "./api";
const samples = [
  "Explain this parcel and its review indicators.",
  "How does Registration & mutation work?",
  "Why do source records show different areas?",
  "How can I import Tamil Nadu records?",
];
export default function Assistant({
  data,
  user,
  run,
  openAuth,
  navigate,
  openParcel,
}) {
  const [status, setStatus] = useState(null),
    [statusError, setStatusError] = useState(null),
    [question, setQuestion] = useState(""),
    [parcel, setParcel] = useState(""),
    [language, setLanguage] = useState("en"),
    [messages, setMessages] = useState([]),
    [busy, setBusy] = useState(false),
    [check, setCheck] = useState(null),
    [checking, setChecking] = useState(false);
  const controller = useRef(),
    bottom = useRef();
  async function load() {
    try {
      setStatus(await api("/ai/status"));
      setStatusError(null);
    } catch (e) {
      setStatusError(e.message);
    }
  }
  useEffect(() => {
    load();
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    if (messages.length) {
      const pane = bottom.current?.parentElement;
      pane?.scrollTo({ top: pane.scrollHeight, behavior: "auto" });
    }
  }, [messages, busy]);
  async function send(text = question) {
    const value = text.trim();
    if (!value || busy) return;
    if (!user) {
      openAuth();
      return;
    }
    setQuestion("");
    setBusy(true);
    const outgoing = { role: "user", content: value };
    setMessages((m) => [...m, outgoing]);
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 55000);
    try {
      const history = messages
        .slice(-6)
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
      const r = await api("/ai/chat", {
        method: "POST",
        body: {
          message: value,
          parcel_id: parcel || undefined,
          language,
          history,
        },
        signal: abort.signal,
      });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: r.answer,
          mode: r.mode,
          sources: r.sources,
          problem: r.providerProblem,
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "error",
          content:
            e.name === "AbortError"
              ? "The request was stopped or timed out. You can retry; the rest of Bhoomi is still available."
              : e.message,
          retry: value,
        },
      ]);
    } finally {
      clearTimeout(timer);
      setBusy(false);
      controller.current = null;
    }
  }
  async function connectionCheck() {
    setChecking(true);
    try {
      setCheck(await post("/ai/check"));
      await load();
    } catch (e) {
      setCheck({ ok: false, message: e.message });
    } finally {
      setChecking(false);
    }
  }
  function source(s) {
    if (s.parcel_id) openParcel(s.parcel_id);
    else navigate("guide");
  }
  return (
    <div className="assistant-layout">
      <section className="panel assistant-panel">
        <div className="panel-heading">
          <div className="assistant-heading">
            <span className="assistant-symbol">
              <Sparkles size={23} />
            </span>
            <div>
              <h3>Bhoomi AI</h3>
              <p>Ask about your demo parcel or the next step.</p>
            </div>
          </div>
          <span
            className={"ai-state " + (status?.configured ? "configured" : "")}
          >
            {status?.configured
              ? "Key configured"
              : status
                ? "Local guide available"
                : "Checking connection…"}
          </span>
        </div>
        <div className="assistant-context">
          <label>
            Parcel context
            <select
              aria-label="AI parcel context"
              value={parcel}
              onChange={(e) => setParcel(e.target.value)}
            >
              <option value="">General application help</option>
              {data.parcels.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.locality}
                </option>
              ))}
            </select>
          </label>
          <label>
            Answer language
            <select
              aria-label="AI answer language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="te">తెలుగు · Telugu</option>
            </select>
          </label>
        </div>
        {statusError && (
          <div className="assistant-alert">
            <AlertTriangle size={17} />
            <p>{statusError}</p>
            <button className="text-button" onClick={load}>
              Retry
            </button>
          </div>
        )}
        {status && !status.configured && (
          <div className="assistant-alert">
            <AlertTriangle size={17} />
            <div>
              <strong>AI connection needs setup</strong>
              <p>
                The app has no server-side OpenRouter key yet. You can still ask
                for a clearly labelled local guide response. Setup steps are on
                the right.
              </p>
            </div>
          </div>
        )}
        <div className="assistant-messages" aria-live="polite">
          {!messages.length && (
            <div className="assistant-welcome">
              <Sparkles size={34} />
              <h2>Make sense of your land records.</h2>
              <p>
                Explain a sample parcel, compare its source records, or
                understand a service workflow. Choose a parcel above for
                specific context.
              </p>
              <div className="assistant-prompts">
                {samples.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setQuestion(q);
                      document.getElementById("ai-question")?.focus();
                    }}
                  >
                    {q}
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <article key={i} className={"chat-message " + m.role}>
              <div className="message-label">
                {m.role === "user"
                  ? "You"
                  : m.role === "error"
                    ? "Request not completed"
                    : m.mode === "ai"
                      ? "Bhoomi AI · OpenRouter"
                      : "Bhoomi local guide · not AI-generated"}
              </div>
              {m.problem && (
                <div className="ai-problem">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>{m.problem.message}</strong>
                    <p>{m.problem.action}</p>
                  </div>
                </div>
              )}
              <div className="message-text">{m.content}</div>
              {m.sources && (
                <div className="answer-sources">
                  <span>Application context</span>
                  {m.sources.map((s) => (
                    <button key={s.id} onClick={() => source(s)}>
                      {s.id} · {s.title}
                      <ArrowUpRight size={12} />
                    </button>
                  ))}
                </div>
              )}
              {m.retry && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => send(m.retry)}
                >
                  Retry question
                </button>
              )}
            </article>
          ))}
          {busy && (
            <div className="assistant-thinking" role="status">
              <RefreshCw size={15} className="spin" />
              Reading the application context and waiting for the provider…
            </div>
          )}
          <div ref={bottom} />
        </div>
        <form
          className="assistant-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label className="sr-only" htmlFor="ai-question">
            Ask Bhoomi AI
          </label>
          <textarea
            id="ai-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={1600}
            rows={2}
            placeholder={
              language === "te"
                ? "మీ question ఇక్కడ రాయండి…"
                : "Ask about a parcel, source mismatch or application step…"
            }
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div>
            <small>
              {question.length}/1600 · Enter to send · Shift+Enter for a new
              line
            </small>
            {busy ? (
              <button
                type="button"
                className="btn secondary"
                onClick={() => controller.current?.abort()}
              >
                <X size={15} />
                Stop
              </button>
            ) : (
              <button className="btn" type="submit" disabled={!question.trim()}>
                <Send size={15} />
                {user ? "Send" : "Enter workspace to ask"}
              </button>
            )}
          </div>
          <p>
            Your question and selected synthetic records are sent to OpenRouter
            when AI is configured. Avoid personal or confidential information.
          </p>
        </form>
      </section>
      <aside className="assistant-side">
        <section className="panel">
          <div className="panel-heading">
            <h3>Connection & setup</h3>
            <button
              className="icon-btn"
              title="Refresh AI status"
              onClick={load}
            >
              <RefreshCw size={15} />
            </button>
          </div>
          <div className="standards">
            <p>
              <strong>Provider</strong>
              <br />
              OpenRouter · server-side key
            </p>
            <p>
              <strong>Status</strong>
              <br />
              {status?.message || "Checking…"}
            </p>
            <p>
              <strong>Default route</strong>
              <br />
              {status?.model || "openrouter/free"}
            </p>
            {!status?.configured && (
              <ol className="ai-setup">
                <li>Open your bhoomi-landstack service in Render.</li>
                <li>
                  Open Environment and add <code>OPENROUTER_API_KEY</code>.
                </li>
                <li>Save and deploy, then refresh this page.</li>
                <li>
                  Optional: set <code>OPENROUTER_MODEL</code> to a valid
                  OpenRouter text model.
                </li>
              </ol>
            )}
            <p className="form-note">
              Never paste the key into this chat, a parcel record, frontend
              source or GitHub.
            </p>
            {user?.department === "administrator" && (
              <button
                className="btn secondary full"
                onClick={connectionCheck}
                disabled={checking}
              >
                {checking ? (
                  <RefreshCw size={15} className="spin" />
                ) : (
                  <ShieldCheck size={15} />
                )}
                Test server key
              </button>
            )}
            {check && (
              <div className={"check-card " + (check.ok ? "" : "high")}>
                {check.ok ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}
                <div>
                  <strong>{check.message}</strong>
                  {check.action && <p>{check.action}</p>}
                </div>
              </div>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h3>Helpful, with clear limits</h3>
          </div>
          <div className="standards">
            <p>
              <ShieldCheck size={15} /> Read-only explanations. AI cannot change
              records or approve requests.
            </p>
            <p>
              Answers use a fresh snapshot of the selected sample parcel, linked
              sources and the app guide.
            </p>
            <p>
              AI can make mistakes. Check the linked records and officer
              decisions. No legal-title or construction approval is provided.
            </p>
            <button
              className="btn secondary full"
              onClick={() => navigate("guide")}
            >
              <BookOpen size={15} />
              Open user guide
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}
