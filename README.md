# Bhoomi · Land Stack

A functioning SIH26014 demonstration of parcel-centric land governance. Synthetic data only; no government affiliation or title certification.

## Features
- 60 clickable GeoJSON parcels across an urban ward and rural village; parcel ID, survey and rights-holder search; zoning and risk layers.
- Linked sample rights, registration, encumbrance, building-permission and fiscal records with source metadata.
- Citizen signup/sign-in, demo citizen and officer sessions, private application tracking.
- Area correction, ownership enquiry and building-permission enquiry services.
- Officer approval/rejection with mandatory reasons, dispute acknowledgement, atomic record changes, immutable application decisions and append-only API audit history.
- Optimistic parcel versions and database row locks protect against conflicting decisions.
- Governance statistics, explainable checks, JSON export and responsive layouts.

## Run locally
Requires Node 22+ and PostgreSQL. Copy `.env.example` to `.env` and configure `DATABASE_URL`. Never commit `.env`.

```sh
npm ci
npm run build
node --env-file=.env server/index.js
```

Open http://localhost:3000. For frontend development, run `npm run dev` alongside the backend.

## Deploy on Render
Create one Node web service with `npm ci && npm run build` as build command and `npm start` as start command. Configure `DATABASE_URL` securely and set `NODE_ENV=production`. Use Oregon for the supplied Oregon database. The server binds to `0.0.0.0` and Render's `PORT`. Readiness endpoint: `/api/health`.

Startup creates only the application-owned `bhoomi` schema and adds missing sample parcels without overwriting existing records. It does not drop or alter unrelated data. Additive startup initialization is protected by a PostgreSQL advisory lock. Database SSL certificate validation stays enabled for remote connections.

## Demonstrate
1. Enter Citizen demo, select `URB-002`, request an area correction and note the tracking ID.
2. Sign out; enter Officer demo, review the matching request and approve with a reason.
3. Open the parcel to see the new area and History entry.
4. Try a second decision on the same request through the API: it returns 409.
5. Select `URB-001` to show a dispute review and its required acknowledgement.

Demo citizen access is browser-session based, expires after 24 hours and is replaced when switching demo roles. Create a citizen account to preserve access to requests across sign-ins. Public Officer demo intentionally permits decisions on synthetic requests only. Avoid personal or confidential data.

## Verification
`npm test` checks fixture integrity and explainable record rules. `npm run build` verifies the frontend bundle. Integration verification covers citizen privacy, registration and login, approvals, rejection, duplicate decisions, dispute routing, stale versions, persistence and database audit changes. See `TECHNICAL.md` for architecture, API details and boundaries.

## Boundaries
No real government connectors, document attachments, real ULPIN issuance, payment, SMS, legal title verification, cadastral accuracy or OGC compliance claim. Registration workflows and notifications are simulated; enquiries record a decision rather than issuing an official approval. A public demo officer is not suitable for production. Production requires verified departmental identities, jurisdiction access, authoritative datasets and formal security/privacy review.
