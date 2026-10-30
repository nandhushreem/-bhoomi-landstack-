# Standard Technical Document — Bhoomi Land Stack v2

SIH26014 · Updated 30 October 2026 · Functional synthetic-data prototype

## 1. Architecture

React/Vite browser client → Express JSON API → PostgreSQL. A single Render Node service serves static assets and APIs. Lazy-loaded screens separate parcel exploration, citizen requests, governance insights, data exchange, integration operations and the guide. Leaflet renders GeoJSON over an attributed OpenStreetMap basemap. Backend modules separate authentication/server setup, workflow, domain validation and platform interfaces.

All application tables use the isolated `bhoomi` schema. No unrelated database objects are changed. Additive startup initialization runs in a transaction with a PostgreSQL advisory lock. Existing parcels are preserved; only missing seed IDs are inserted.

## 2. Data schemas

| Table              | Purpose and integrity                                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| users              | UUID, name, unique email, scrypt password hash, citizen/officer role, department, jurisdiction, demo flag                                                        |
| sessions           | SHA-256 hash of random session token, user reference, 24-hour expiry                                                                                             |
| parcels            | Unique internal parcel ID and JSONB record: state, survey, demo identifier, rights holder, area, use, constraints, fiscal values, geometry, version, source date |
| source_records     | Independent rights, registration, planning and fiscal values with department/source/update metadata                                                              |
| applications       | Citizen, parcel, service, requested values, payload, status, current department, parcel version and demo due date                                                |
| tasks              | Ordered departmental stages; unique application/stage; state, decision reason, actor and completion time                                                         |
| audit              | Parcel/application, actor, action, before/after values, reason, timestamp                                                                                        |
| notifications      | Citizen-specific request update, read status and timestamp                                                                                                       |
| integration_events | Unique application/stage event key, parcel/department/payload, delivery state, attempts and last error                                                           |
| import_batches     | Source, state adapter, record count, actor and commit date                                                                                                       |
| bookmarks          | Unique user/parcel pair                                                                                                                                          |

Foreign keys prevent orphaned workflow data. Indexes cover users' applications, task application references, notification owners, parcel source records and state expressions. The prototype stores geometry as GeoJSON JSONB; a production rollout should use PostGIS geometry columns and spatial indexes.

## 3. Roles and authorization

Registered users can create citizen accounts only. Demo officers select Revenue, Registration, Planning, Tax & valuation or Platform administrator. Ordinary officers can decide only the currently assigned department's task, within their state jurisdiction. The administrator can review all departments and import/process synthetic data. Public demo access is intentional and unsuitable for a real government system.

Citizen application, notification and bookmark queries filter by the authenticated database user. Role/state decisions are enforced on the server, independent of UI controls. A legacy officer without department metadata defaults to Revenue for backward compatibility.

## 4. API and interoperability standards

JSON over HTTP, UTF-8, 1 MB payload limit. The UI limits uploaded JSON files to 900 KB and imports to 200 records. Errors use `{error:string}`; validation can also return `errors`. Relevant responses: 400 invalid data, 401 missing session, 403 unauthorized department/state, 404 missing record, 409 duplicate/final/stale conflict, 429 throttling and 500 transient server error. Rate-limit responses are JSON.

The OpenAPI 3.1 document at `/api/docs` lists paths, request properties, path/query parameters, cookie authentication and response statuses. It is an interface contract, not a claim that every response has a detailed generated domain schema.

Key routes:

| Group         | Routes                                                                        |
| ------------- | ----------------------------------------------------------------------------- |
| Identity      | auth/me, auth/register, auth/login, auth/demo, auth/logout                    |
| Parcels       | parcels, parcels/:id/records, parcels/:id/spatial, parcels/:id/history        |
| Services      | applications, applications/:id/decision, applications/:id/withdraw            |
| Citizen tools | notifications, notifications/read, bookmarks, bookmarks/:id                   |
| Governance    | analytics, quality, layers, configuration                                     |
| Exchange      | exchange/template/:state, exchange/preview, exchange/import, exchange/batches |
| Integration   | integrations, integrations/process                                            |
| Operations    | health, docs                                                                  |

These routes are under `/api`. Experimental feature routes are under `/ogc`.

## 5. State adapters and units

| Profile        | ID / survey / holder fields             | Source area | Conversion to m² |
| -------------- | --------------------------------------- | ----------- | ---------------- |
| Karnataka      | parcel_id / survey_number / holder_name | extent_sq_m | × 1              |
| Tamil Nadu     | parcel_ref / survey_no / pattadar       | extent_ha   | × 10,000         |
| Andhra Pradesh | land_ref / survey_ref / occupant        | extent_acre | × 4,046.8564224  |

Profiles expose language metadata and configurable terminology. They are synthetic demonstration mappings, not official government API schemas. UTF-8 names and source values are retained. Preview normalizes a copy without modifying the source payload.

Validation checks supported state, source-name length, 1–200 rows, unique uppercase DEMO identifiers, required rights-holder/survey/locality fields, positive bounded areas, land use, Urban/Rural context and a structurally valid, closed, single-ring GeoJSON Polygon. Full cadastral topology, self-intersection and survey-accuracy validation are production work. Duplicate existing IDs block an import. A database transaction commits parcels, source records, batch metadata and audit together; a concurrent uniqueness conflict rolls the batch back.

## 6. GIS exchange and spatial layers

GeoJSON uses WGS84 longitude/latitude, with closed polygon rings. No official ULPIN is issued; DEMO identifiers are explicitly synthetic. Seeded cadastral overlays are illustrative and are not aligned to surveyed property boundaries.

Synthetic environmental review polygons and utility corridor lines are available through `/api/layers`. Turf geometric intersection tests report overlays that intersect or touch a parcel. Geometry area is an illustrative geodesic calculation and is displayed separately from recorded area. Valuation is recorded area multiplied by a synthetic per-square-metre rate; it is not a market appraisal.

Experimental OGC-style routes provide discovery, collection metadata, individual features, limit/offset pagination, state filtering and bounding-box envelope filtering. Default limit 50; maximum 200. `/ogc/conformance` deliberately advertises no conformance classes because formal OGC testing/certification has not been completed. Production should use appropriate projected CRS for area, authoritative topology and standards validation.

## 7. Workflow state machines

Applications begin Submitted or Under review when a synthetic dispute flag is active. Each service creates ordered tasks; the first is Pending and later stages Waiting.

| Service                     | Department route                | Implemented effect                                                                        |
| --------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- |
| Area correction             | Revenue                         | Update area/version on approval                                                           |
| Ownership enquiry           | Revenue                         | Record an answer                                                                          |
| Building permission enquiry | Planning                        | Record an answer                                                                          |
| Registration & mutation     | Registration → Revenue → Fiscal | Record registration review; mutate rights holder at Revenue; final fiscal acknowledgement |
| Building permission         | Planning → Fiscal               | Record demo planning approval, then fiscal acknowledgement                                |
| Dispute report              | Revenue                         | Set synthetic dispute flag                                                                |
| Dispute resolution          | Revenue                         | Clear synthetic dispute flag after acknowledged review                                    |
| Tax assessment review       | Fiscal                          | Record assessment review; no automatic waiver/payment                                     |

Approval completes the current stage and activates the next. Intermediate status is In progress; final stage becomes Approved. Rejection finalizes the request and cancels future stages. A citizen can withdraw only before any stage approval. Target dates are configurable demonstration service targets, not statutory commitments.

## 8. Transaction and concurrency controls

A decision transaction locks the application and parcel, checks department/state, verifies a pending task and compares the captured parcel version. Final decisions and stale approvals return 409. Disputed parcels require explicit acknowledgement. Planning approval requires restriction review; conservation designation blocks demo building approval.

Record changes, task outcome, next assignment, audit, delivery event and citizen notification commit together. Registration review alone never changes the rights-holder record. Mutation increments the parcel version and updates the application's captured version before the fiscal stage. A rapid identical citizen resubmission is rejected to reduce accidental duplicates. This is not a global idempotency key for arbitrary client retries.

## 9. Mock departmental integration

Every approved review stage creates a unique persistent delivery event. Administrators can process up to 10 pending/failed events, process a single event or simulate an unavailable adapter. Failed events retain payload, attempt count and error and can be retried. Delivered events are excluded from replay.

Delivery updates the corresponding independent local department source record in a transaction. Event parcel versions prevent older deliveries from replacing newer delivered source values. `FOR UPDATE SKIP LOCKED` avoids duplicate concurrent event processing. Department outages do not undo committed decisions. No external government API is called; processing is explicitly triggered through the operations interface rather than an always-running worker.

## 10. Record quality and governance analytics

Rules compare source areas and rights holders with current parcel records, identify missing rights sources and expose dispute, tax, mortgage and conservation indicators. Every finding states the rule and conflicting values/context. No automatic conflict resolution or fraud/legal verdict is produced. Source synchronization can resolve differences after approved decisions; independent historical inconsistencies remain visible.

Insights include state-filtered parcel/use/fiscal/quality counts, explicitly all-state application outcome counts and downloadable findings. No trained ML, predictive accuracy or satellite change-detection claim is made.

## 11. Security framework

Passwords use scrypt with random per-user salts. Session cookies contain 256-bit random tokens; only token hashes persist in PostgreSQL. Cookies are HttpOnly, SameSite=Lax, and Secure in production, with a 24-hour expiry. SQL uses parameters. Payload and string lengths are bounded, origins are checked for mutations, and Helmet sets security headers/CSP.

Global API limits and mutation-specific sign-in limits are separate; normal session reads do not consume the sign-in quota. Sensitive credentials live only in ignored local environment files and Render environment settings. Remote database TLS certificate validation stays enabled. API error logs avoid request bodies and secrets.

Synthetic parcel/source/history information is public. Private citizen request descriptions, email addresses and sessions are not included in public parcel endpoints. Decision reasons are visible in synthetic parcel audit history; do not enter personal/confidential information. Audit routes are append-only through the application, but database administrators retain normal authority. Formal penetration testing, regulatory compliance and legal assurance are not claimed.

## 12. UI/UX and colour system

Forest #123C31 sidebar, #164D3B actions, neutral #F6F7F3 canvas and #D6B36E accents. Zoning colours have accompanying labels. Status and quality severity are expressed in text as well as colour. Desktop map/detail layouts stack on mobile. Tables support horizontal scrolling within their container.

Forms have labels and validation; controls have visible focus; dialogs trap focus and close with Escape; notifications announce status; loading/error/empty states are provided; reduced-motion preference is respected. The keyboard-accessible parcel directory supplements the map. The built-in guide has a printable layout and a simple Telugu quick-start sentence. Formal WCAG conformance is not claimed.

## 13. Deployment and scaling

Node 22+, Express, React/Vite, PostgreSQL pool maximum five connections. One free Render web service in Oregon uses an externally supplied database URL. Runtime startup binds `0.0.0.0` and platform PORT. `/api/health` checks database readiness and reports version 2. SIGTERM closes HTTP and the connection pool.

No extra paid resource is required by this enhancement. The free service can sleep when idle. The database retains its own provider lifecycle/expiry and external access configuration. Data migrations are additive and remain compatible with the previous release's basic records.

Production scaling requires PostGIS indexing, viewport queries/vector tiles, cursor pagination, migration tooling, scheduled session cleanup, a background delivery worker, authorized adapters, source freshness monitoring, observability, capacity testing and disaster-recovery exercises. Current application lists cap at 300 and integration lists at 100; this is a prototype capacity limit, not nationwide scalability evidence.

## 14. Verification

Unit checks cover three-state fixture uniqueness, closed rings, state-unit normalization, malformed/duplicate input, department/jurisdiction authorization, workflow separation and explainable rule outputs. PostgreSQL-backed API verification performs 79 HTTP checks on a uniquely imported disposable parcel. It covers registration/login persistence, privacy, multi-stage mutation, planning acknowledgement, disputes, stale versions, withdrawal, notifications, bookmarks, fail/retry/idempotency and GeoJSON pagination.

Browser verification covers desktop/mobile, state filters, overlays, citizen registration request, three departmental approvals, administrator import validation/commit, integration console, quality insights and guide navigation. The tests use separate synthetic fixtures and remove only their own rows. CI executes unit checks and a production build without secrets. Dependency audit results are recorded at release time rather than treated as a permanent security guarantee.

## 15. Optional OpenRouter AI assistant (v2.1)

The sidebar AI screen sends questions to `/api/ai/chat`. The server validates input/history, requires a session, retrieves only public synthetic parcel/source information and selected operation-guide excerpts, and calls OpenRouter through the installed AI SDK's OpenAI-compatible provider. The default model is `openrouter/free`, verified against the provider model catalogue at implementation time. No tool execution or record-changing capability is exposed to the model.

`OPENROUTER_API_KEY` is server-only; `OPENROUTER_MODEL` is optional. No provider credential is sent to the browser, put in a prompt or returned by diagnostics. `/api/ai/status` reports key presence; `/api/ai/check` lets a demo administrator validate provider authentication, without returning account/key details. Key presence and valid authentication do not guarantee model availability or credits.

Questions are limited to 1,600 characters, history to eight bounded user/assistant messages (at most six forwarded), output to 1,100 tokens and provider generation to 45 seconds with no automatic retries. Chat/check share a per-IP limit of eight calls per minute. The UI can stop requests and renders model text safely without HTML interpretation. It offers English/Telugu and independently supplied source buttons. Conversations stay in page memory; the app does not persist chat transcripts.

Provider authentication, budget, permission, rate, model and timeout errors map to non-sensitive user-facing diagnostics. Unavailable AI returns an explicitly labelled deterministic Local guide response, not a fabricated successful AI answer. The UI tells users that messages and selected synthetic records go to OpenRouter. Real confidential land data must not be used without a separate data-processing/security review. AI explanations never establish title, permissible construction, legal advice or a government decision.

Verification includes a mocked OpenRouter response exercising the actual installed SDK request/response contract, input-role validation, credential isolation and provider error mapping. Live provider generation must be separately verified after the actual deployment key is available; local/mock success is not provider-connectivity evidence.

## 16. Production handoff

Replace public demo roles with verified identities and least-privilege jurisdiction assignments. Obtain authorized land/source records and connectivity agreements. Confirm each state's actual mutation/planning/dispute rules and required evidence. Add verified document storage, retention policy, recovery/backups, monitoring and formal security/accessibility evaluation. Preserve legal decision authority with responsible government officers. See REQUIREMENTS.md for the prototype's requirement coverage and explicit remaining boundaries.
