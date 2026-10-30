export const departments = {
  revenue: "Revenue",
  registration: "Registration",
  planning: "Planning",
  fiscal: "Tax & valuation",
  administrator: "Platform administrator",
};
export const profiles = {
  KA: {
    name: "Karnataka",
    language: "Kannada",
    areaUnit: "sq_m",
    areaFactor: 1,
    fields: {
      id: "parcel_id",
      survey_no: "survey_number",
      owner: "holder_name",
      area: "extent_sq_m",
    },
  },
  TN: {
    name: "Tamil Nadu",
    language: "Tamil",
    areaUnit: "hectare",
    areaFactor: 10000,
    fields: {
      id: "parcel_ref",
      survey_no: "survey_no",
      owner: "pattadar",
      area: "extent_ha",
    },
  },
  AP: {
    name: "Andhra Pradesh",
    language: "Telugu",
    areaUnit: "acre",
    areaFactor: 4046.8564224,
    fields: {
      id: "land_ref",
      survey_no: "survey_ref",
      owner: "occupant",
      area: "extent_acre",
    },
  },
};
export const services = {
  "Area correction": {
    departments: ["revenue"],
    days: 3,
    description: "Review a recorded-area correction with a reason.",
  },
  "Ownership record enquiry": {
    departments: ["revenue"],
    days: 2,
    description: "Ask about the linked sample rights record.",
  },
  "Building permission enquiry": {
    departments: ["planning"],
    days: 5,
    description: "Review permissible use and an enquiry response.",
  },
  "Registration & mutation": {
    departments: ["registration", "revenue", "fiscal"],
    days: 7,
    description:
      "Registration review, rights-record mutation and tax-account synchronization.",
  },
  "Building permission": {
    departments: ["planning", "fiscal"],
    days: 7,
    description: "Planning review followed by fiscal acknowledgement.",
  },
  "Dispute report": {
    departments: ["revenue"],
    days: 3,
    description: "Report a parcel record issue for human review.",
  },
  "Dispute resolution": {
    departments: ["revenue"],
    days: 5,
    description: "Review evidence and resolve a synthetic dispute flag.",
  },
  "Tax assessment review": {
    departments: ["fiscal"],
    days: 4,
    description: "Review the linked sample tax assessment; no online payment.",
  },
};
export const allowedZones = [
  "Residential",
  "Commercial",
  "Mixed use",
  "Public use",
  "Agricultural",
  "Conservation",
];
export function canWork(user, department, state) {
  return (
    user?.role === "officer" &&
    (user.department === "administrator" ||
      ((user.department || "revenue") === department &&
        (user.jurisdiction === "ALL" ||
          !user.jurisdiction ||
          user.jurisdiction === state)))
  );
}
export function parcelFeature(p) {
  const { geometry, checks, ...properties } = p;
  return { type: "Feature", id: p.id, geometry, properties };
}
export function geometryBounds(g) {
  const ring = g?.coordinates?.[0] || [];
  return [
    Math.min(...ring.map((p) => p[0])),
    Math.min(...ring.map((p) => p[1])),
    Math.max(...ring.map((p) => p[0])),
    Math.max(...ring.map((p) => p[1])),
  ];
}
export function validGeometry(g) {
  if (
    g?.type !== "Polygon" ||
    !Array.isArray(g.coordinates) ||
    g.coordinates.length !== 1
  )
    return false;
  const r = g.coordinates[0];
  return (
    Array.isArray(r) &&
    r.length >= 4 &&
    r.length <= 500 &&
    r.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every(Number.isFinite) &&
        Math.abs(p[0]) <= 180 &&
        Math.abs(p[1]) <= 90,
    ) &&
    r[0][0] === r.at(-1)[0] &&
    r[0][1] === r.at(-1)[1]
  );
}
export function validateImport(payload) {
  const profile =
    typeof payload?.state === "string" && Object.hasOwn(profiles, payload.state)
      ? profiles[payload.state]
      : null;
  if (!profile)
    return { errors: ["Choose a supported state profile"], records: [] };
  if (
    !Array.isArray(payload.records) ||
    !payload.records.length ||
    payload.records.length > 200
  )
    return {
      errors: ["Provide 1–200 records in a JSON records array"],
      records: [],
    };
  if (
    typeof payload.source !== "string" ||
    payload.source.trim().length < 3 ||
    payload.source.length > 100
  )
    return {
      errors: ["Provide a source dataset name of 3–100 characters"],
      records: [],
    };
  const errors = [],
    records = [],
    seen = new Set();
  payload.records.forEach((raw, i) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`Row ${i + 1}: each record must be a JSON object`);
      return;
    }
    const f = profile.fields,
      id = raw[f.id],
      area = Number(raw[f.area]) * profile.areaFactor,
      owner = raw[f.owner],
      survey = raw[f.survey_no];
    const row = [];
    if (typeof id !== "string" || !/^DEMO-[A-Z0-9-]{3,50}$/.test(id))
      row.push(
        "parcel identifier must start DEMO- and use uppercase letters/numbers/hyphens",
      );
    if (seen.has(id)) row.push("duplicate parcel identifier");
    seen.add(id);
    if (
      typeof owner !== "string" ||
      owner.trim().length < 2 ||
      owner.length > 100
    )
      row.push("rights-holder name is required");
    if (typeof survey !== "string" || !survey.trim() || survey.length > 80)
      row.push("survey reference is required");
    if (!Number.isFinite(area) || area <= 0 || area > 10000000)
      row.push("area is invalid");
    if (!validGeometry(raw.geometry))
      row.push(
        "provide a closed single-ring GeoJSON Polygon with valid coordinates",
      );
    if (!allowedZones.includes(raw.zone))
      row.push("land-use category is invalid");
    if (!["Urban", "Rural"].includes(raw.context))
      row.push("context must be Urban or Rural");
    if (
      typeof raw.locality !== "string" ||
      !raw.locality.trim() ||
      raw.locality.length > 120
    )
      row.push("locality is required");
    if (row.length) errors.push(`Row ${i + 1}: ${row.join("; ")}`);
    else
      records.push({
        id,
        survey_no: survey.trim(),
        demo_identifier: id,
        owner: owner.trim(),
        area: Math.round(area * 100) / 100,
        zone: raw.zone,
        locality: raw.locality.trim(),
        context: raw.context,
        state: payload.state,
        state_name: profile.name,
        tax_due: 0,
        disputed: false,
        encumbrance: "No sample encumbrance",
        permission: "No active application",
        version: 1,
        registered_at: null,
        source_updated: new Date().toISOString().slice(0, 10),
        source: payload.source.trim(),
        geometry: raw.geometry,
      });
  });
  return { errors, records };
}
