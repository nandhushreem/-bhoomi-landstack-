# Standard Technical Document — SIH26014

## 1. Architecture
React/Vite browser client → Express JSON API → PostgreSQL. One Render Node web service serves both compiled static assets and API. Leaflet displays GeoJSON on an OpenStreetMap context layer. Tile attribution remains visible. All parcel overlays are synthetic.

## 2. Data model
All tables live in the isolated `bhoomi` schema: `users`, `sessions`, `parcels`, `applications`, `audit`. Parcel JSON contains source labels, a demo identifier, jurisdiction, area, use, rights holder, constraints, fiscal status, geometry and record version. User IDs are UUIDs. Application IDs use random references. Sessions persist only SHA-256 token hashes. Database changes use parameters rather than interpolated user input.

## 3. API standards
JSON over HTTP, UTF-8, maximum 32 KB request payload. Errors are `{error:string}` and use 400/401/403/404/409/429/500 as appropriate. Endpoint summary: `/api/docs`.

| Method | Endpoint | Access |
|---|---|---|
| GET | /api/health | Public readiness, database SELECT 1 |
| GET | /api/auth/me | Current session |
| POST | /api/auth/register | Public, citizen accounts only |
| POST | /api/auth/login | Public |
| POST | /api/auth/demo | Public, explicit synthetic-data demo |
| POST | /api/auth/logout | Current session |
| GET | /api/parcels | Public synthetic records |
| GET | /api/parcels/:id/history | Public synthetic audit history, no application descriptions |
| GET | /api/applications | Citizen's own requests or officer queue |
| POST | /api/applications | Citizen |
| POST | /api/applications/:id/decision | Officer |
| GET | /api/analytics | Aggregate demo statistics |

Application body: `{parcel_id,service,details,requested_area?}`. Supported services: Area correction, Ownership record enquiry, Building permission enquiry. Decision body: `{decision:'Approved'|'Rejected',reason,dispute_reviewed?}`.

## 4. Interoperability
Internal parcel ID joins datasets. Official ULPIN would be an external identifier in a real adapter; `DEMO-*` is not ULPIN. Source formats are represented as synthetic linked records; no live departmental integration is claimed. Submitted requests create an audit event with simulated departmental checks. Approvals record a simulated fiscal notification. Future adapters need schema mapping, unit and CRS conversion, idempotent events, retries, source provenance and reconciliation.

## 5. GIS standards
GeoJSON Polygon coordinates are WGS84 longitude,latitude. Rings are closed. The displayed sample area is a fixture attribute, not a surveyed area derived from synthetic geometry. No OGC API – Features certification or conformance is claimed. Production should preserve authoritative CRS metadata, validate topology, calculate area in suitable projected CRS and provide an OGC-compatible feature endpoint. Parcel split/merge lineage is future work.

## 6. Workflow and integrity
Disputed parcels enter Under review; other applications enter Submitted. An officer approves or rejects with a reason. Approval on disputed parcels requires explicit acknowledgement. A transaction locks the application then parcel; already-final decisions return 409. Approved requests reject a stale parcel version. Area corrections update area/version/date, then decision and audit are committed together. Enquiry approval is only a recorded answer, not a title or planning certificate.

## 7. Security
Passwords use scrypt with per-user random salt. Sessions use 256-bit random tokens, server-side hashes, 24-hour expiry and HttpOnly/SameSite=Lax cookies, Secure in production. Roles come from database records, never request roles except the deliberately public demo mode. API rate limits, origin checks, Helmet content policy, body limits, parameterized queries and server-side validation are enabled. Citizen applications are private to their account; demo officers have global synthetic queue access. Audit API omits application descriptions and private email. Audit rows are append-only through application routes; database administrators retain normal authority. No secrets are committed. Do not store sensitive information in this demo.

## 8. UI/UX and colours
Forest green #123C31 navigation, #164D3B primary actions, warm neutral #F6F7F3 background and #D6B36E accents. Zoning layers use distinct green, ochre, blue and violet fills. Status labels include text, not colour alone. Responsive desktop/mobile layout, labelled form fields, visible focus, modal focus trapping, Escape close, loading/error/empty states and reduced-motion support. Keyboard parcel selection is provided by directory buttons; the map is supplemented by a table. Formal WCAG conformance is not claimed.

## 9. Deployment and scaling
Node >=22, PostgreSQL pool limit 5; TLS validation enabled remotely. Build `npm ci && npm run build`; start `npm start`; readiness `/api/health`. Runtime secrets belong in Render environment variables. Startup initialization is additive under a transaction/advisory lock. Graceful SIGTERM closes HTTP and database connections. For scaling: spatial PostGIS storage/indexes, viewport pagination/vector tiles, background adapters, managed migrations, session cleanup, source freshness monitoring, backups and recovery testing. The current prototype loads 60 parcels and caps application listing at 300.

## 10. Requirement traceability
| Requirement | Demonstration | Limitation |
|---|---|---|
| Parcel visualization | Explorer and searchable directory | Synthetic boundaries |
| Multiple domains | Parcel Records and Overview tabs | Sample linked datasets |
| Citizen service | Requests and tracking | No official submission |
| Department workflow | Officer queue and atomic area correction | Other departments simulated |
| Security and audit | Session permissions, versions, History | Public demo officer intentional |
| Governance analytics | Insights, zone counts, indicators | Rules, not ML |
| Rural/urban | Two pilot contexts | One state fixture |
| Interoperability | JSON API, common ID, metadata | No live adapters/OGC compliance |
| Standard Technical Document | This document | Production standards require validation |

## 11. Evaluation
Verify signup/login, isolation between citizens, denied citizen decisions, complete approval, rejection, duplicate requests/decisions, disputed review, stale concurrent requests, persistence across sessions, history and database readiness. Unit checks cover data integrity and rule outputs. CI builds the frontend and runs unit checks on every push.
