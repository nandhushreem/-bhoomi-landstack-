import React, { useEffect, useRef } from "react";
import { X, FileText } from "lucide-react";
export function Badge({ children }) {
  return (
    <span
      className={"badge " + String(children).toLowerCase().replaceAll(" ", "-")}
    >
      {children}
    </span>
  );
}
export function Stat({ label, value, note, icon: Icon }) {
  return (
    <div className="stat">
      <div>
        <span className="stat-label">{label}</span>
        <strong>{value ?? "—"}</strong>
        <p>{note}</p>
      </div>
      <span className="stat-icon">
        <Icon size={20} />
      </span>
    </div>
  );
}
export function Empty({ title, description }) {
  return (
    <div className="empty">
      <FileText size={36} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const prev = document.activeElement,
      el = ref.current;
    el.querySelector("button,input,select,textarea")?.focus();
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab") return;
      const all = [
        ...el.querySelectorAll("button,input,select,textarea,a[href]"),
      ].filter((n) => !n.disabled && !n.closest("[hidden]"));
      const first = all[0],
        last = all.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={ref}
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Record({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );
}
