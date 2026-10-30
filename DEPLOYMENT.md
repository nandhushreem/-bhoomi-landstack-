# Deployment record

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

## Operation

The free Render service can sleep when idle. Allow time for the first visit to wake it. The source branch is `main`; automatic deployment is configured in Render. If the public Git repository connection does not provide commit webhooks, trigger a deploy from the dashboard after pushing changes. Secrets and data remain outside GitHub. The database is externally supplied and retains its own provider lifecycle and access settings.

## Demonstration boundaries

All parcels and linked records are synthetic. Public demo officer access is intentional for friend/judge testing. No government transactions, real title validation or live government APIs are provided. Do not enter sensitive information.
