# Deployment record

Current release: **Bhoomi Land Stack v2.1**. It includes a read-only OpenRouter AI assistant in English/Telugu, source context, server-side key diagnostics and explicit local-guide fallback, alongside the v2 parcel and department workflows.

AI setup: add `OPENROUTER_API_KEY` securely in this Render service's Environment, then save and deploy. Optional `OPENROUTER_MODEL` defaults to `openrouter/free`. Key presence, provider authentication and successful model generation are separately reported; do not infer live provider success from local mocked tests.

- Application: https://bhoomi-landstack.onrender.com
- Source: https://github.com/nandhushreem/-bhoomi-landstack-
- Render service: `srv-dbi751ifngtc73cgbn80`
- Dashboard: https://dashboard.render.com/web/srv-dbi751ifngtc73cgbn80
- Workspace: user-confirmed `1nc24cs150` connection
- Region: Oregon
- Compute: free
- Build: `npm ci --include=dev && npm run build`
- Start: `npm start`
- Runtime: Node 22.16.0
- Secret configuration: `DATABASE_URL` in Render environment variables; never in repository
- Readiness endpoint: `/api/health`

## Verification on 30 October 2026

Passed: unit checks, production frontend build, dependency audit (no reported production vulnerabilities), PostgreSQL-backed API workflow and live HTTPS browser workflow. API checks cover signup/login, session persistence, citizen privacy, denied unauthorized decisions, approval, rejection, audit history, duplicate-decision protection, dispute routing, stale-version protection and invalid input. Browser checks cover desktop explorer, citizen submission, officer approval, insights, mobile layout and runtime errors.

Version 2 verification: seven unit checks, production build and zero reported production dependency vulnerabilities. The expanded API suite performs 79 HTTP checks on disposable fixtures. Browser verification covers a complete three-department registration request, state filtering, overlays, administrator import preview/commit, sync console, source quality dashboard, mobile layout and built-in guide. It reported no browser runtime errors.

Version 2.1 adds five AI unit/SDK-contract checks and a separate assistant browser check. Local verification confirms safe key handling, invalid-input rejection, SDK request parsing, guest sign-in return, answer/source rendering, mobile layout and explicit provider/local response labels. Live key/model verification is performed after deployment and must be reported according to the actual result.

Live v2.1 verification on 30 October 2026: the deployed server detected its OpenRouter key, OpenRouter accepted authentication, and the unmocked frontend test received real AI-mode responses for English parcel information and a Telugu workflow question. The public app's full browser flow and 79 HTTP checks also passed. No manual key update was needed after the AI integration was deployed.

Map repair: the deployed `Referrer-Policy: no-referrer` suppressed the Referer required by the former OSM raster provider. The app now uses an attributed OpenFreeMap/MapLibre vector basemap, a bundled same-origin worker and `strict-origin-when-cross-origin`. A provider error, unavailable WebGL or initial-load timeout leaves parcel boundaries and records usable with a manual retry. A focused fixture browser check verifies rendering, CSP, navigation cleanup, forced HTTP 403, retry recovery and mobile layout without fetching public tiles. Workflow browser checks also use a local basemap fixture. Use `MAP_LIVE=1 TEST_BASE_URL=https://bhoomi-landstack.onrender.com node test/map-browser.mjs` for one initial-viewport public-provider check; it performs no scripted panning, zoom sweep or bulk download.

Guide: https://bhoomi-landstack.onrender.com/#guide

PDF: https://bhoomi-landstack.onrender.com/bhoomi-user-guide.pdf

## Operation

The free Render service can sleep when idle. Allow time for the first visit to wake it. The source branch is `main`; automatic deployment is configured in Render. If the public Git repository connection does not provide commit webhooks, trigger a deploy from the dashboard after pushing changes. Secrets and data remain outside GitHub. The database is externally supplied and retains its own provider lifecycle and access settings.

## Demonstration boundaries

All parcels and linked records are synthetic. Public demo officer access is intentional for friend/judge testing. No government transactions, real title validation or live government APIs are provided. Do not enter sensitive information.
