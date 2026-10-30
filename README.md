# Bhoomi · Land Stack

**[Open the live application](https://bhoomi-landstack.onrender.com)** · **[User guide](https://bhoomi-landstack.onrender.com/#guide)**

Version 2 is a functional SIH26014 prototype connecting parcel records, citizen services, departmental reviews and mock source systems. All land data is synthetic. No government affiliation, legal-title certification or real government transactions are claimed.

## What you can demonstrate

- Bhoomi AI: a read-only OpenRouter assistant using current sample parcel records and the operation guide, with English/Telugu answers, source links, server-side key handling and explicit local-guide fallback on provider errors. Open `/#assistant` in the live app.

- 180 seeded parcels across urban/rural pilots in Karnataka, Tamil Nadu and Andhra Pradesh. Existing pilot records are preserved; imports add to this count.
- Searchable maps, land-use/risk layers, restriction and utility overlays, bookmarks, linked records, history, spatial intersection checks and GeoJSON/summary exports.
- Citizen signup/login, eight land services, tracking receipts, notifications and withdrawal before first review.
- Registration → Revenue → Tax workflow. Registration approval does not mutate ownership; the Revenue stage changes the synthetic rights holder and record version. Fiscal acknowledgement completes the request.
- Planning → Tax building-permission workflow, conservation checks, dispute reporting/resolution and fiscal review.
- Server-enforced department and state permissions. Demo officer access is public by design.
- Configurable sample state adapters, hectare/acre conversion, validation preview and atomic JSON import without overwriting existing records.
- Durable departmental delivery events, outage simulation, retry, duplicate-delivery protection and source-version protection.
- Explainable cross-source area/rights-holder comparisons, governance statistics and exportable findings.
- Experimental OGC-style feature discovery, GeoJSON queries, bounding-box filters and pagination. No formal OGC conformance/certification claim.
- Built-in, printable user guide and a four-page PDF guide.

## Try it

1. Select **Enter workspace → Citizen demo**. Choose **URB-002** in Karnataka's urban pilot and request **Registration & mutation** with a new sample rights holder.
2. Keep the citizen window open. Use a separate private/incognito browser window for officers.
3. Select **Registration** in Demo department, then **Officer demo**. Find the tracking reference and approve with a reason.
4. Use **Switch workspace** to enter Revenue, then Tax & valuation, and complete the next tasks.
5. Return to the citizen, refresh, and inspect the timeline, notifications and parcel history.
6. As Platform administrator, demonstrate Data exchange and Department sync.

Demo sessions last 24 hours. Switching demo identities does not retain access to the previous demo citizen's requests. Create a citizen account when you need to return later. Do not enter sensitive information.

## Run locally

Requires Node 22+ and PostgreSQL. Copy `.env.example` to `.env` and configure `DATABASE_URL`. Never commit secrets.

```sh
npm ci
npm run build
node --env-file=.env server/index.js
```

Open http://localhost:3000. For frontend development, run `npm run dev` alongside the backend. Development proxy targets port 3000.

## Deploy on Render

For AI, add `OPENROUTER_API_KEY` securely in this service's Render Environment, then save and deploy. Never use a `VITE_` key or commit the secret. `OPENROUTER_MODEL` defaults to `openrouter/free`; optional paid models use your provider account limits. `/api/ai/status` exposes configuration status only. In Platform administrator demo, the AI page's Test server key checks provider authentication without generating tokens. Chat requires a session and is rate-limited.

- Node web service, Oregon, free compute.
- Build: `npm ci --include=dev && npm run build`.
- Start: `npm start`.
- Set `DATABASE_URL` securely and `NODE_ENV=production`.
- The server binds to `0.0.0.0` and Render's `PORT`; readiness endpoint `/api/health`.
- The database remains externally supplied. Startup creates/migrates only the `bhoomi` schema under an advisory lock. Existing parcel records are not reseeded over user changes.

See [deployment record](DEPLOYMENT.md) for service details. Public Git URL deployments can require a manual Render deploy after pushing, even when automatic deployment is configured.

## Verify

```sh
npm test
npm run build
npm audit --omit=dev
```

With the backend running, set `TEST_BASE_URL` to the intended **synthetic demonstration instance** and run:

```sh
node --env-file=.env test/integration.mjs
npx playwright install chromium
node --env-file=.env test/browser.mjs
```

The API suite exercises 79 HTTP checks, using a uniquely imported test parcel and disposable accounts. Browser verification uses a separate test parcel and cleans up its own records. Both require database access to remove only their test fixtures. Do not run these scripts against a system containing real land records. CI runs unit checks and builds the frontend; it does not require database credentials.

`npm run format` formats the source. `npm run guide` synchronizes the Markdown guide with the built-in guide text.

## Project documentation

- [Operator guide](OPERATOR_GUIDE.md)
- [Standard Technical Document](TECHNICAL.md)
- [Requirement coverage](REQUIREMENTS.md)
- [Deployment record](DEPLOYMENT.md)
- API specification: `/api/docs`
- Feature discovery: `/ogc`

## Production boundaries

No authorized government connectors, surveyed cadastral data, actual ULPIN issuance, legal title verification, document-file uploads, payment processing, SMS, satellite change detection or trained predictive model. Evidence references are plain text. Demo approvals and valuation references have no legal effect. A real deployment needs verified departmental identities, official state rules, production backups/recovery and independent security/privacy/accessibility validation.
