import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { pool } from "./db.js";
import { services, profiles, departments } from "./domain.js";
import { guideSections } from "../src/guide-content.js";
import {
  aiConfiguration,
  providerProblem,
  validateQuestion,
  generateAnswer,
  localAnswer,
} from "./ai-service.js";
export const assistant = Router();
const auth = (req, res, next) =>
  req.user
    ? next()
    : res.status(401).json({
        error: "Enter a citizen or officer workspace to use Bhoomi AI.",
      });
const chatLimit = rateLimit({
  windowMs: 60000,
  limit: 8,
  message: {
    error:
      "You have sent several AI questions. Wait a minute before sending another.",
  },
});
assistant.get("/ai/status", (req, res) => {
  const c = aiConfiguration();
  res.json({
    configured: Boolean(c.key),
    provider: "OpenRouter",
    model: c.model,
    readOnly: true,
    localGuide: true,
    message: c.key
      ? "Server key is configured. Send a question to verify model access."
      : "AI key is not configured in the running Render service.",
    setup: c.key
      ? null
      : {
          variable: "OPENROUTER_API_KEY",
          location: "Render → bhoomi-landstack → Environment",
          action:
            "Add the key securely, then save and deploy. Never paste it into the chat or frontend.",
        },
  });
});
assistant.post("/ai/check", auth, chatLimit, async (req, res) => {
  if (req.user.department !== "administrator")
    return res.status(403).json({
      error: "Use Platform administrator demo to run the connection check.",
    });
  const c = aiConfiguration();
  if (!c.key)
    return res.json({
      ok: false,
      code: "KEY_MISSING",
      message:
        "OPENROUTER_API_KEY is missing from this service. Add it in Render Environment and save/deploy.",
    });
  try {
    const r = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${c.key}` },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw { statusCode: r.status };
    await r.json();
    res.json({
      ok: true,
      code: "KEY_VALID",
      message:
        "OpenRouter accepted the server key. Send an AI question to verify model availability.",
      model: c.model,
    });
  } catch (e) {
    res.json({ ok: false, ...providerProblem(e) });
  }
});
assistant.post("/ai/chat", auth, chatLimit, async (req, res) => {
  const invalid = validateQuestion(req.body);
  if (invalid) return res.status(400).json({ error: invalid });
  const { message, language = "en", history = [] } = req.body;
  const detected = message
    .toUpperCase()
    .match(
      /\b(?:(?:TN|AP)-)?(?:URB|VIL)-\d{3}\b|\bDEMO-[A-Z0-9-]{3,55}\b/,
    )?.[0];
  const id = req.body.parcel_id || detected;
  let parcel = null,
    records = [];
  if (id) {
    const r = await pool.query("SELECT data FROM bhoomi.parcels WHERE id=$1", [
      id,
    ]);
    parcel = r.rows[0]?.data;
    if (!parcel)
      return res.status(404).json({
        error:
          "That parcel was not found in the demo dataset. Choose a parcel from the list.",
      });
    records = (
      await pool.query(
        "SELECT domain,source,record_values,updated_at FROM bhoomi.source_records WHERE parcel_id=$1 ORDER BY domain",
        [id],
      )
    ).rows;
  }
  const sources = [
    {
      id: "S1",
      title: parcel
        ? `${parcel.id} · current parcel record`
        : "Bhoomi user guide",
      href: parcel ? "#explore" : "#guide",
      ...(parcel ? { parcel_id: parcel.id } : {}),
    },
    {
      id: "S2",
      title: parcel
        ? "Linked department source records"
        : "Services and department review routes",
      href: parcel ? "#explore" : "#guide",
      ...(parcel ? { parcel_id: parcel.id } : {}),
    },
    { id: "S3", title: "How to use Bhoomi", href: "#guide" },
  ];
  const words = message
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
  const guide = [...guideSections]
    .map(([title, paragraphs]) => ({
      title,
      paragraphs,
      score: words.reduce(
        (n, w) =>
          n + (title + " " + paragraphs.join(" ")).toLowerCase().includes(w),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ score, ...s }) => s);
  const context = {
    data_mode: "Synthetic demonstration",
    snapshot_at: new Date().toISOString(),
    sources,
    parcel: parcel
      ? {
          id: parcel.id,
          owner: parcel.owner,
          area: parcel.area,
          zone: parcel.zone,
          state: parcel.state_name,
          locality: parcel.locality,
          disputed: parcel.disputed,
          tax_due: parcel.tax_due,
          permission: parcel.permission,
          encumbrance: parcel.encumbrance,
          version: parcel.version,
        }
      : null,
    records,
    services,
    department_names: departments,
    state_profiles: Object.fromEntries(
      Object.entries(profiles).map(([k, v]) => [
        k,
        { name: v.name, areaUnit: v.areaUnit },
      ]),
    ),
    guide,
  };
  const c = aiConfiguration();
  const fallback = (problem) =>
    res.json({
      mode: "local",
      answer: localAnswer({ message, parcel, language }),
      sources,
      providerProblem: problem,
      readOnly: true,
    });
  if (!c.key)
    return fallback({
      code: "KEY_MISSING",
      message: "AI is not connected: the running server has no OpenRouter key.",
      action:
        "Add OPENROUTER_API_KEY to the bhoomi-landstack Render service, then save and deploy.",
    });
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    const result = await generateAnswer(
      { message, history, language, context },
      { configuration: c, signal: controller.signal },
    );
    if (!res.destroyed)
      res.json({ mode: "ai", ...result, sources, readOnly: true });
  } catch (e) {
    if (!res.destroyed) fallback(providerProblem(e));
  }
});
