import { Router } from "express";
import { randomUUID } from "node:crypto";
import { booleanIntersects } from "@turf/boolean-intersects";
import { area } from "@turf/area";
import { pool } from "./db.js";
import {
  departments,
  profiles,
  services,
  validateImport,
  parcelFeature,
  geometryBounds,
} from "./domain.js";
import { spatialLayers, sourceRecords, recordChecks } from "./seed.js";
export const platform = Router();
const fail = (status, message) => Object.assign(new Error(message), { status });
const auth = (req, res, next) =>
  req.user
    ? next()
    : res.status(401).json({ error: "Please sign in to continue" });
const admin = (req, res, next) =>
  req.user?.role === "officer" && req.user.department === "administrator"
    ? next()
    : res
        .status(403)
        .json({ error: "Platform administrator demo access is required" });
platform.get("/configuration", (req, res) =>
  res.json({
    version: "2.0.0",
    profiles,
    departments,
    services,
    limits: { importRows: 200, applicationList: 300 },
    dataMode: "synthetic",
  }),
);
platform.get("/layers", (req, res) =>
  res.json({
    type: "FeatureCollection",
    features: spatialLayers().filter(
      (f) => !req.query.state || f.properties.state === req.query.state,
    ),
  }),
);
platform.get("/parcels/:id/records", async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id,domain,department,source,record_values AS "values",updated_at FROM bhoomi.source_records WHERE parcel_id=$1 ORDER BY domain',
    [req.params.id],
  );
  res.json({ records: rows });
});
platform.get("/parcels/:id/spatial", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT data FROM bhoomi.parcels WHERE id=$1",
    [req.params.id],
  );
  if (!rows[0]) throw fail(404, "Parcel not found");
  const p = rows[0].data;
  const intersects = spatialLayers().filter(
    (f) =>
      f.properties.state === p.state &&
      booleanIntersects(p.geometry, f.geometry),
  );
  res.json({
    intersections: intersects.map((f) => ({ id: f.id, ...f.properties })),
    geometry_area: Math.round(area(p.geometry)),
    recorded_area: p.area,
    valuation_reference: Math.round(p.area * (p.valuation_rate || 2000)),
    valuation_rate: p.valuation_rate || 2000,
    notice:
      "Synthetic geometry area and valuation are illustrative. Neither is a survey, legal restriction or market appraisal.",
  });
});
platform.get("/quality", async (req, res) => {
  const [{ rows: parcels }, { rows: sources }] = await Promise.all([
    pool.query("SELECT data FROM bhoomi.parcels"),
    pool.query(
      "SELECT parcel_id,domain,record_values FROM bhoomi.source_records",
    ),
  ]);
  const indexed = new Map();
  for (const s of sources) {
    if (!indexed.has(s.parcel_id)) indexed.set(s.parcel_id, []);
    indexed.get(s.parcel_id).push(s);
  }
  const issues = parcels.flatMap(({ data: p }) => {
    const records = indexed.get(p.id) || [];
    const findings = recordChecks(p).map((c) => ({
      ...c,
      parcel_id: p.id,
      state: p.state,
      locality: p.locality,
    }));
    for (const r of records) {
      if (
        r.record_values.area != null &&
        Math.abs(Number(r.record_values.area) - p.area) > 0.01
      )
        findings.push({
          parcel_id: p.id,
          state: p.state,
          locality: p.locality,
          severity: "high",
          code: "AREA_MISMATCH",
          title: "Source area differs from parcel record",
          detail: `${r.domain}: ${r.record_values.area} m²; parcel: ${p.area} m². Preserve both until reviewed.`,
          source: r.domain,
        });
      if (r.record_values.owner && r.record_values.owner !== p.owner)
        findings.push({
          parcel_id: p.id,
          state: p.state,
          locality: p.locality,
          severity: "high",
          code: "HOLDER_MISMATCH",
          title: "Rights-holder records differ",
          detail: `${r.domain} and the current parcel record have different sample rights-holder names.`,
          source: r.domain,
        });
    }
    if (!records.some((r) => r.domain === "rights"))
      findings.push({
        parcel_id: p.id,
        state: p.state,
        severity: "high",
        code: "MISSING_RIGHTS",
        title: "Missing rights source",
        detail: "No linked rights record",
      });
    return findings;
  });
  res.json({
    issues,
    total: issues.length,
    method:
      "Deterministic explainable rules; not a fraud verdict or ML prediction",
  });
});
platform.get("/integrations", auth, async (req, res) => {
  if (req.user.role !== "officer") throw fail(403, "Officer access required");
  const values = [],
    where = [];
  if (req.user.department !== "administrator") {
    values.push(req.user.department || "revenue");
    where.push(`e.department=$${values.length}`);
    if (req.user.jurisdiction && req.user.jurisdiction !== "ALL") {
      values.push(req.user.jurisdiction);
      where.push(`p.data->>'state'=$${values.length}`);
    }
  }
  const { rows } = await pool.query(
    `SELECT e.* FROM bhoomi.integration_events e JOIN bhoomi.parcels p ON p.id=e.parcel_id ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY e.id DESC LIMIT 100`,
    values,
  );
  res.json({
    events: rows,
    mode: "Simulated department adapters; no external government calls",
  });
});
platform.post("/integrations/process", admin, async (req, res) => {
  const { event_id, simulate_failure } = req.body;
  if (
    event_id != null &&
    (!Number.isSafeInteger(Number(event_id)) || Number(event_id) <= 0)
  )
    throw fail(400, "Invalid event reference");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await c.query(
      `SELECT * FROM bhoomi.integration_events WHERE status IN ('Pending','Failed') ${event_id ? "AND id=$1" : ""} ORDER BY id LIMIT 10 FOR UPDATE SKIP LOCKED`,
      event_id ? [event_id] : [],
    );
    const outcomes = [];
    for (const e of result.rows) {
      if (simulate_failure === true) {
        await c.query(
          "UPDATE bhoomi.integration_events SET status='Failed',attempts=attempts+1,last_error='Simulated department unavailable' WHERE id=$1",
          [e.id],
        );
        outcomes.push({ id: e.id, status: "Failed" });
        continue;
      }
      const domain = {
        revenue: "rights",
        registration: "registration",
        planning: "planning",
        fiscal: "fiscal",
      }[e.department];
      const p = e.payload.values || {};
      const values =
        domain === "rights"
          ? { owner: p.owner, area: p.area }
          : domain === "registration"
            ? { owner: p.owner, area: p.area, deed_ref: e.application_id }
            : domain === "planning"
              ? { zone: p.zone, permission: p.permission }
              : { tax_due: p.tax_due };
      values._parcel_version = e.payload.parcel_version;
      await c.query(
        "INSERT INTO bhoomi.source_records(id,parcel_id,domain,department,source,record_values) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET record_values=bhoomi.source_records.record_values || EXCLUDED.record_values,source=EXCLUDED.source,updated_at=now() WHERE COALESCE((bhoomi.source_records.record_values->>'_parcel_version')::int,0)<=COALESCE((EXCLUDED.record_values->>'_parcel_version')::int,0)",
        [
          `${e.parcel_id}:${domain}`,
          e.parcel_id,
          domain,
          e.department,
          "Simulated departmental API",
          values,
        ],
      );
      await c.query(
        "UPDATE bhoomi.integration_events SET status='Delivered',attempts=attempts+1,last_error=null,delivered_at=now() WHERE id=$1",
        [e.id],
      );
      outcomes.push({ id: e.id, status: "Delivered" });
    }
    await c.query("COMMIT");
    res.json({
      processed: outcomes,
      notice: "Delivery updates local mock department source records only.",
    });
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
});
platform.get("/exchange/template/:state", (req, res) => {
  const code = req.params.state,
    p = Object.hasOwn(profiles, code) ? profiles[code] : null;
  if (!p) throw fail(404, "State profile not found");
  const f = p.fields;
  const x = code === "KA" ? 77.61 : code === "TN" ? 80.28 : 80.58,
    y = code === "KA" ? 13.01 : code === "TN" ? 13.11 : 16.55;
  res.json({
    state: code,
    source: `${p.name} sample adapter`,
    records: [
      {
        [f.id]: `DEMO-${code}-IMPORT-001`,
        [f.survey_no]: "SAMPLE-501/A",
        [f.owner]: "Sample Citizen",
        [f.area]: code === "KA" ? 1200 : code === "TN" ? 0.12 : 0.2965264578,
        zone: "Residential",
        context: "Urban",
        locality: `${p.name} import pilot`,
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [x, y],
              [x + 0.0004, y],
              [x + 0.0004, y + 0.0003],
              [x, y + 0.0003],
              [x, y],
            ],
          ],
        },
      },
    ],
  });
});
async function preview(payload) {
  const result = validateImport(payload);
  if (result.errors.length) return result;
  const { rows } = await pool.query(
    "SELECT id FROM bhoomi.parcels WHERE id=ANY($1::text[])",
    [result.records.map((p) => p.id)],
  );
  for (const r of rows)
    result.errors.push(
      `${r.id}: already exists; imports never overwrite parcel records`,
    );
  return result;
}
platform.post("/exchange/preview", admin, async (req, res) => {
  const result = await preview(req.body);
  res.json({
    valid: result.errors.length === 0,
    errors: result.errors,
    normalized: result.records,
    unit: "m²",
    profile: profiles[req.body.state],
  });
});
platform.post("/exchange/import", admin, async (req, res) => {
  const result = await preview(req.body);
  if (result.errors.length)
    return res
      .status(400)
      .json({ error: "Dataset validation failed", errors: result.errors });
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const id = randomUUID();
    await c.query(
      "INSERT INTO bhoomi.parcels(id,data) SELECT id,data FROM jsonb_to_recordset($1::jsonb) AS p(id text,data jsonb)",
      [JSON.stringify(result.records.map((p) => ({ id: p.id, data: p })))],
    );
    const sources = result.records
      .flatMap((p) => sourceRecords(p, 1))
      .map(({ values, ...r }) => ({
        ...r,
        record_values: values,
        source: req.body.source,
      }));
    await c.query(
      "INSERT INTO bhoomi.source_records(id,parcel_id,domain,department,source,record_values) SELECT id,parcel_id,domain,department,source,record_values FROM jsonb_to_recordset($1::jsonb) AS s(id text,parcel_id text,domain text,department text,source text,record_values jsonb)",
      [JSON.stringify(sources)],
    );
    await c.query(
      "INSERT INTO bhoomi.import_batches(id,user_id,source,state,count) VALUES($1,$2,$3,$4,$5)",
      [
        id,
        req.user.id,
        req.body.source.trim(),
        req.body.state,
        result.records.length,
      ],
    );
    for (const p of result.records)
      await c.query(
        "INSERT INTO bhoomi.audit(parcel_id,actor,action,detail) VALUES($1,$2,$3,$4)",
        [
          p.id,
          req.user.name,
          "Dataset imported",
          {
            batch: id,
            source: req.body.source,
            state: req.body.state,
            normalized_unit: "m²",
          },
        ],
      );
    await c.query("COMMIT");
    res.status(201).json({ batch: id, imported: result.records.length });
  } catch (e) {
    await c.query("ROLLBACK");
    if (e.code === "23505")
      throw fail(
        409,
        "A parcel identifier already exists. Refresh the preview.",
      );
    throw e;
  } finally {
    c.release();
  }
});
platform.get("/exchange/batches", admin, async (req, res) =>
  res.json({
    batches: (
      await pool.query(
        "SELECT id,source,state,count,created_at FROM bhoomi.import_batches ORDER BY created_at DESC LIMIT 50",
      )
    ).rows,
  }),
);
export const geo = Router();
geo.get("/", (req, res) =>
  res.json({
    title: "Bhoomi parcel feature service",
    description:
      "Experimental OGC-style discovery and GeoJSON query interface; not certified.",
    links: [
      { href: "/ogc/collections", rel: "data", type: "application/json" },
      {
        href: "/ogc/conformance",
        rel: "conformance",
        type: "application/json",
      },
      {
        href: "/api/docs",
        rel: "service-desc",
        type: "application/vnd.oai.openapi+json;version=3.1",
      },
    ],
  }),
);
geo.get("/conformance", (req, res) =>
  res.json({
    conformsTo: [],
    note: "OGC-style routes are implemented; formal conformance testing has not been completed. No certification is claimed.",
  }),
);
const collection = {
  id: "parcels",
  title: "Synthetic land parcels",
  description:
    "Demo parcels across three states; GeoJSON in WGS84 longitude/latitude.",
  itemType: "feature",
  crs: ["http://www.opengis.net/def/crs/OGC/1.3/CRS84"],
  links: [
    {
      href: "/ogc/collections/parcels/items",
      rel: "items",
      type: "application/geo+json",
    },
  ],
};
geo.get("/collections", (req, res) =>
  res.json({
    collections: [collection],
    links: [
      { href: "/ogc/collections", rel: "self", type: "application/json" },
    ],
  }),
);
geo.get("/collections/parcels", (req, res) => res.json(collection));
geo.get("/collections/parcels/items", async (req, res) => {
  const limit = Number(req.query.limit ?? 50),
    offset = Number(req.query.offset ?? 0),
    bbox = req.query.bbox
      ? String(req.query.bbox).split(",").map(Number)
      : null;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 200 ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    (bbox &&
      (bbox.length !== 4 ||
        !bbox.every(Number.isFinite) ||
        bbox[0] >= bbox[2] ||
        bbox[1] >= bbox[3]))
  )
    throw fail(
      400,
      "Use limit 1–200, nonnegative offset and bbox west,south,east,north",
    );
  if (req.query.state && !Object.hasOwn(profiles, req.query.state))
    throw fail(400, "Unknown state filter");
  const { rows } = await pool.query(
    "SELECT data FROM bhoomi.parcels ORDER BY id",
  );
  const all = rows
    .map((r) => r.data)
    .filter(
      (p) =>
        (!req.query.state || p.state === req.query.state) &&
        (!bbox ||
          (() => {
            const b = geometryBounds(p.geometry);
            return (
              b[0] <= bbox[2] &&
              b[2] >= bbox[0] &&
              b[1] <= bbox[3] &&
              b[3] >= bbox[1]
            );
          })()),
    );
  const params = new URLSearchParams(req.query);
  const links = [
    { href: req.originalUrl, rel: "self", type: "application/geo+json" },
  ];
  if (offset + limit < all.length) {
    params.set("offset", offset + limit);
    links.push({
      href: "/ogc/collections/parcels/items?" + params,
      rel: "next",
      type: "application/geo+json",
    });
  }
  res.type("application/geo+json").json({
    type: "FeatureCollection",
    features: all.slice(offset, offset + limit).map(parcelFeature),
    numberMatched: all.length,
    numberReturned: all.slice(offset, offset + limit).length,
    timeStamp: new Date().toISOString(),
    links,
  });
});
geo.get("/collections/parcels/items/:id", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT data FROM bhoomi.parcels WHERE id=$1",
    [req.params.id],
  );
  if (!rows[0]) throw fail(404, "Parcel not found");
  res.type("application/geo+json").json(parcelFeature(rows[0].data));
});
