import { services } from "./domain.js";
const json = {
  description: "JSON response",
  content: { "application/json": { schema: { type: "object" } } },
};
const error = {
  description: "Request rejected",
  content: {
    "application/json": {
      schema: { type: "object", properties: { error: { type: "string" } } },
    },
  },
};
const response = (summary, secured = false) => ({
  summary,
  ...(secured ? { security: [{ session: [] }] } : {}),
  responses: {
    200: json,
    400: error,
    401: error,
    403: error,
    409: error,
    429: error,
  },
});
const body = (properties, required = []) => ({
  required: true,
  content: {
    "application/json": { schema: { type: "object", properties, required } },
  },
});
const str = { type: "string" };
export const specification = {
  openapi: "3.1.0",
  info: {
    title: "Bhoomi Land Stack API",
    version: "2.0.0",
    description:
      "SIH26014 synthetic demonstration. Department/state-scoped session authorization, staged workflows, data normalization and durable mock integration events. GeoJSON uses WGS84 longitude/latitude. Public officer demo access is intentional.",
  },
  components: {
    securitySchemes: {
      session: { type: "apiKey", in: "cookie", name: "bhoomi_session" },
    },
  },
  paths: {
    "/api/health": { get: response("Database readiness") },
    "/api/auth/me": { get: response("Current session identity") },
    "/api/auth/demo": {
      post: {
        ...response("Create an explicit synthetic-data demo session"),
        requestBody: body(
          { role: { type: "string", enum: ["citizen", "officer"] } },
          ["role"],
        ),
      },
    },
    "/api/auth/register": {
      post: {
        ...response("Create citizen account"),
        requestBody: body(
          {
            name: str,
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 10, maxLength: 128 },
          },
          ["name", "email", "password"],
        ),
        responses: { 201: json, 400: error, 409: error, 429: error },
      },
    },
    "/api/auth/login": {
      post: {
        ...response("Sign in"),
        requestBody: body({ email: str, password: str }, ["email", "password"]),
      },
    },
    "/api/auth/logout": { post: response("End current session", true) },
    "/api/parcels": {
      get: response("Read synthetic parcel records, geometry and indicators"),
    },
    "/api/parcels/{id}/history": {
      get: {
        ...response("Read synthetic parcel audit history"),
        parameters: [{ name: "id", in: "path", required: true, schema: str }],
      },
    },
    "/api/applications": {
      get: response("Citizen own requests or officer queue", true),
      post: {
        ...response("Submit citizen request", true),
        requestBody: body(
          {
            parcel_id: str,
            service: {
              type: "string",
              enum: [
                "Area correction",
                "Ownership record enquiry",
                "Building permission enquiry",
              ],
            },
            details: { type: "string", minLength: 10, maxLength: 2000 },
            requested_area: {
              type: "number",
              exclusiveMinimum: 0,
              maximum: 10000000,
            },
          },
          ["parcel_id", "service", "details"],
        ),
        responses: {
          201: json,
          400: error,
          401: error,
          403: error,
          404: error,
          429: error,
        },
      },
    },
    "/api/applications/{id}/decision": {
      post: {
        ...response(
          "Officer decision with atomic record update and version check",
          true,
        ),
        parameters: [{ name: "id", in: "path", required: true, schema: str }],
        requestBody: body(
          {
            decision: { type: "string", enum: ["Approved", "Rejected"] },
            reason: { type: "string", minLength: 10, maxLength: 1000 },
            dispute_reviewed: { type: "boolean" },
          },
          ["decision", "reason"],
        ),
      },
    },
    "/api/analytics": {
      get: response("Aggregate synthetic governance statistics"),
    },
  },
};
const idParameter = { name: "id", in: "path", required: true, schema: str };
for (const [path, title, secure] of [
  ["/api/configuration", "State profiles, departments and services", false],
  ["/api/layers", "Synthetic spatial overlays", false],
  ["/api/quality", "Explainable cross-source record checks", false],
  ["/api/notifications", "Current citizen notifications", true],
  ["/api/bookmarks", "Current user saved parcels", true],
  ["/api/integrations", "Department-scoped mock delivery log", true],
  ["/api/exchange/batches", "Administrator import history", true],
])
  specification.paths[path] = { get: response(title, secure) };
for (const [path, title] of [
  ["/api/parcels/{id}/records", "Linked source records and metadata"],
  [
    "/api/parcels/{id}/spatial",
    "Synthetic layer intersections and illustrative valuation",
  ],
])
  specification.paths[path] = {
    get: { ...response(title), parameters: [idParameter] },
  };
specification.paths["/api/auth/demo"].post.requestBody = body(
  {
    role: { type: "string", enum: ["citizen", "officer"] },
    department: {
      type: "string",
      enum: ["revenue", "registration", "planning", "fiscal", "administrator"],
    },
    jurisdiction: { type: "string", enum: ["ALL", "KA", "TN", "AP"] },
  },
  ["role"],
);
Object.assign(
  specification.paths["/api/applications"].post.requestBody.content[
    "application/json"
  ].schema.properties,
  {
    service: { type: "string", enum: Object.keys(services) },
    new_owner: { type: "string", minLength: 2, maxLength: 100 },
    proposed_use: {
      type: "string",
      enum: [
        "Residential",
        "Commercial",
        "Mixed use",
        "Public use",
        "Agricultural",
      ],
    },
    reference: { type: "string", maxLength: 100 },
  },
);
specification.paths["/api/applications/{id}/decision"].post.summary =
  "Approve or reject the currently assigned department stage; final stage completes request";
specification.paths["/api/applications/{id}/decision"].post.requestBody.content[
  "application/json"
].schema.properties.acknowledge_restrictions = { type: "boolean" };
specification.paths["/api/applications/{id}/withdraw"] = {
  post: {
    ...response("Citizen withdraws request before first review", true),
    parameters: [idParameter],
  },
};
specification.paths["/api/bookmarks/{id}"] = {
  post: {
    ...response("Save or unsave parcel", true),
    parameters: [idParameter],
    requestBody: body({ saved: { type: "boolean" } }, ["saved"]),
  },
};
specification.paths["/api/notifications/read"] = {
  post: response("Mark current user notifications read", true),
};
specification.paths["/api/integrations/process"] = {
  post: {
    ...response(
      "Administrator delivers or simulates failure of local mock events",
      true,
    ),
    requestBody: body({
      event_id: { type: "integer", minimum: 1 },
      simulate_failure: { type: "boolean" },
    }),
  },
};
const dataset = body(
  {
    state: { type: "string", enum: ["KA", "TN", "AP"] },
    source: { type: "string", minLength: 3, maxLength: 100 },
    records: {
      type: "array",
      minItems: 1,
      maxItems: 200,
      items: { type: "object" },
    },
  },
  ["state", "source", "records"],
);
specification.paths["/api/exchange/preview"] = {
  post: {
    ...response(
      "Administrator validates and normalizes a synthetic dataset",
      true,
    ),
    requestBody: dataset,
  },
};
specification.paths["/api/exchange/import"] = {
  post: {
    ...response(
      "Administrator atomically imports new parcels without overwriting",
      true,
    ),
    requestBody: dataset,
    responses: { 201: json, 400: error, 403: error, 409: error },
  },
};
specification.paths["/api/exchange/template/{state}"] = {
  get: {
    ...response("Download state-specific synthetic dataset template"),
    parameters: [
      {
        name: "state",
        in: "path",
        required: true,
        schema: { type: "string", enum: ["KA", "TN", "AP"] },
      },
    ],
  },
};
for (const [path, title] of [
  ["/ogc", "Experimental feature discovery"],
  ["/ogc/conformance", "Conformance status; no certification claimed"],
  ["/ogc/collections", "Feature collections"],
  ["/ogc/collections/parcels", "Parcel collection metadata"],
])
  specification.paths[path] = { get: response(title) };
specification.paths["/ogc/collections/parcels/items"] = {
  get: {
    ...response("Paginated synthetic GeoJSON parcel features"),
    parameters: [
      {
        name: "limit",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 200 },
      },
      { name: "offset", in: "query", schema: { type: "integer", minimum: 0 } },
      {
        name: "state",
        in: "query",
        schema: { type: "string", enum: ["KA", "TN", "AP"] },
      },
      {
        name: "bbox",
        in: "query",
        schema: { type: "string" },
        description: "west,south,east,north in WGS84",
      },
    ],
  },
};
specification.paths["/ogc/collections/parcels/items/{id}"] = {
  get: {
    ...response("Single parcel GeoJSON feature"),
    parameters: [idParameter],
  },
};
