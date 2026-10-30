import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import {
  randomBytes,
  randomUUID,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, initialize } from "./db.js";
import { recordChecks } from "./seed.js";
import { specification } from "./openapi.js";
import { workflow } from "./workflow.js";
import { platform, geo } from "./platform.js";
import { assistant } from "./assistant.js";
import { departments, profiles } from "./domain.js";
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  req.body ??= {};
  next();
});
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 240,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Wait a minute and try again." },
  }),
);
app.post(
  ["/api/auth/register", "/api/auth/login", "/api/auth/demo"],
  rateLimit({
    windowMs: 60000,
    limit: 20,
    message: {
      error: "Too many sign-in attempts. Wait a minute and try again.",
    },
  }),
);
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.get("host"))
        return res.status(403).json({ error: "Request origin rejected" });
    } catch {
      return res.status(403).json({ error: "Invalid origin" });
    }
  }
  next();
});
const hash = (t) => createHash("sha256").update(t).digest("hex");
const cleanUser = (u) => ({
  id: u.id,
  name: u.name,
  role: u.role,
  demo: u.demo,
  department: u.department || null,
  jurisdiction: u.jurisdiction || "ALL",
});
function passwordHash(p, s = randomBytes(16).toString("hex")) {
  return `${s}:${scryptSync(p, s, 64).toString("hex")}`;
}
function verify(p, h) {
  const [s, v] = h.split(":");
  return timingSafeEqual(Buffer.from(v, "hex"), scryptSync(p, s, 64));
}
async function session(res, u) {
  const t = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO bhoomi.sessions VALUES($1,$2,now()+interval '24 hours')",
    [hash(t), u.id],
  );
  res.cookie("bhoomi_session", t, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 86400000,
    path: "/",
  });
  return cleanUser(u);
}
app.use("/api", async (req, res, next) => {
  try {
    const raw = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("bhoomi_session="))
      ?.split("=")[1];
    if (raw && /^[a-f0-9]{64}$/.test(raw)) {
      const { rows } = await pool.query(
        "SELECT u.* FROM bhoomi.sessions s JOIN bhoomi.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",
        [hash(raw)],
      );
      req.user = rows[0];
    }
    next();
  } catch (e) {
    next(e);
  }
});
const auth = (req, res, next) =>
  req.user
    ? next()
    : res.status(401).json({ error: "Please sign in to continue" });
const officer = (req, res, next) =>
  req.user?.role === "officer"
    ? next()
    : res.status(403).json({ error: "Officer access required" });
app.get("/api/health", async (req, res) => {
  await pool.query("SELECT 1");
  res.json({
    status: "ok",
    project: "SIH26014",
    data: "synthetic demonstration",
    version: "2.1.0",
  });
});
app.get("/api/auth/me", (req, res) =>
  res.json({ user: req.user ? cleanUser(req.user) : null }),
);
app.post("/api/auth/demo", async (req, res) => {
  const role = req.body.role === "officer" ? "officer" : "citizen";
  const department =
    role === "officer" ? req.body.department || "revenue" : null;
  if (
    department &&
    (typeof department !== "string" || !Object.hasOwn(departments, department))
  )
    return res.status(400).json({ error: "Unknown department" });
  const jurisdiction = req.body.jurisdiction || "ALL";
  if (
    typeof jurisdiction !== "string" ||
    (jurisdiction !== "ALL" && !Object.hasOwn(profiles, jurisdiction))
  )
    return res.status(400).json({ error: "Unknown state jurisdiction" });
  const u = {
    id: randomUUID(),
    name:
      role === "officer"
        ? "Demo " + departments[department] + " Officer"
        : "Demo Citizen",
    role,
    demo: true,
    department,
    jurisdiction,
  };
  await pool.query(
    "INSERT INTO bhoomi.users(id,name,role,demo,department,jurisdiction) VALUES($1,$2,$3,true,$4,$5)",
    [u.id, u.name, u.role, department, jurisdiction],
  );
  res.json({ user: await session(res, u) });
});
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.length > 80 ||
    typeof email !== "string" ||
    email.length > 200 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 128
  )
    return res.status(400).json({
      error: "Enter a name, valid email and password of 10–128 characters",
    });
  try {
    const { rows } = await pool.query(
      "INSERT INTO bhoomi.users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,'citizen') RETURNING *",
      [
        randomUUID(),
        name.trim(),
        email.toLowerCase().trim(),
        passwordHash(password),
      ],
    );
    res.status(201).json({ user: await session(res, rows[0]) });
  } catch (e) {
    if (e.code === "23505")
      return res.status(409).json({ error: "Email already registered" });
    throw e;
  }
});
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    password.length > 128
  )
    return res.status(400).json({ error: "Invalid sign-in details" });
  const { rows } = await pool.query(
    "SELECT * FROM bhoomi.users WHERE email=$1",
    [email.toLowerCase().trim()],
  );
  if (!rows[0]?.password_hash || !verify(password, rows[0].password_hash))
    return res.status(401).json({ error: "Email or password incorrect" });
  res.json({ user: await session(res, rows[0]) });
});
app.post("/api/auth/logout", async (req, res) => {
  const t = req.headers.cookie?.match(/bhoomi_session=([a-f0-9]{64})/)?.[1];
  if (t)
    await pool.query("DELETE FROM bhoomi.sessions WHERE token_hash=$1", [
      hash(t),
    ]);
  res.clearCookie("bhoomi_session", { path: "/" });
  res.json({ ok: true });
});
app.get("/api/parcels", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT data FROM bhoomi.parcels ORDER BY id",
  );
  res.json({
    parcels: rows.map((r) => ({ ...r.data, checks: recordChecks(r.data) })),
  });
});
app.get("/api/parcels/:id/history", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id,actor,action,detail,created_at FROM bhoomi.audit WHERE parcel_id=$1 ORDER BY id DESC",
    [req.params.id],
  );
  res.json({ events: rows });
});
app.get("/api/analytics", async (req, res) => {
  const { rows } = await pool.query("SELECT data FROM bhoomi.parcels");
  const p = rows.map((r) => r.data);
  const counts = await pool.query(
    "SELECT status,count(*)::int count FROM bhoomi.applications GROUP BY status",
  );
  res.json({
    total: p.length,
    rural: p.filter((v) => v.context === "Rural").length,
    urban: p.filter((v) => v.context === "Urban").length,
    disputes: p.filter((v) => v.disputed).length,
    taxDue: p.reduce((s, v) => s + Number(v.tax_due), 0),
    checks: p.reduce((s, v) => s + recordChecks(v).length, 0),
    zones: Object.fromEntries(
      [...new Set(p.map((v) => v.zone))].map((z) => [
        z,
        p.filter((v) => v.zone === z).length,
      ]),
    ),
    applications: counts.rows,
  });
});
app.use("/api", assistant);
app.use("/api", workflow);
app.use("/api", platform);
app.use("/ogc", geo);
app.get("/api/docs", (req, res) => res.json(specification));
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Endpoint not found" }),
);
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);
app.use(express.static(root));
app.get("/{*path}", (req, res) => res.sendFile(path.join(root, "index.html")));
app.use((err, req, res, next) => {
  console.error("Request failed:", err.code || err.name);
  res.status(err.status >= 400 && err.status < 500 ? err.status : 500).json({
    error:
      err.status >= 400 && err.status < 500
        ? err.message
        : "Service temporarily unavailable. Please try again.",
  });
});
await initialize();
const server = app.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () =>
  console.log("Bhoomi Land Stack ready"),
);
process.on("SIGTERM", () =>
  server.close(() => pool.end().then(() => process.exit(0))),
);
