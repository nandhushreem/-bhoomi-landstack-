import React from "react";
import { ArrowRight, Printer, ShieldCheck, CheckCircle2 } from "lucide-react";
import { guideSections as sections } from "./guide-content";

export default function Guide({ navigate }) {
  return (
    <div className="guide-page">
      <div className="guide-hero">
        <span className="eyebrow">BHOOMI / QUICK START + OPERATOR GUIDE</span>
        <h2>
          Open a parcel.
          <br />
          Follow the whole story.
        </h2>
        <p>
          Simple instructions for citizens, department officers and a complete
          demonstration.
        </p>
        <p className="telugu-note">
          సింపుల్‌గా: parcel ఎంచుకోండి → request పంపండి → department review
          చేయండి → status, history చూడండి.
        </p>
        <div className="button-row left no-print">
          <button className="btn" onClick={() => navigate("explore")}>
            Start exploring <ArrowRight size={16} />
          </button>
          <button className="btn secondary" onClick={() => window.print()}>
            <Printer size={16} />
            Print / save PDF
          </button>
          <a className="btn secondary" href="/bhoomi-user-guide.pdf" download>
            Download guide PDF
          </a>
        </div>
        <div className="guide-cover-note">
          Version 2 · SIH26014 · Synthetic data · 30 October 2026
        </div>
      </div>
      <div className="guide-caution">
        <ShieldCheck size={20} />
        <p>
          <strong>Before you start:</strong> this is a demonstration, not a
          government portal. Demo officers can change sample data. Do not enter
          confidential information, identity numbers, real deeds or payment
          details.
        </p>
      </div>
      {sections.map(([title, paragraphs], i) => (
        <section className="guide-section" key={title}>
          <div className="guide-section-number">
            {String(i + 1).padStart(2, "0")}
          </div>
          <div>
            <h2>{title}</h2>
            {paragraphs.map((p, n) => (
              <p key={n}>{p}</p>
            ))}
          </div>
        </section>
      ))}
      <div className="guide-end">
        <CheckCircle2 size={20} />
        <p>
          Tell one parcel’s story from citizen request to departmental decisions
          and source synchronization.
        </p>
      </div>
    </div>
  );
}
export { sections as guideSections };
