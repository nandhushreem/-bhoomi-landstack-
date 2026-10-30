# Bhoomi Land Stack — User Guide

Version 2.1 · SIH26014 · 30 October 2026

Live app: https://bhoomi-landstack.onrender.com

Online guide: https://bhoomi-landstack.onrender.com/#guide

Synthetic demonstration only. No government affiliation, legal title verification or actual government transactions. Avoid sensitive information.

## 1. Ask Bhoomi AI

Open Bhoomi AI in the sidebar. Enter a citizen or officer workspace, choose an optional parcel context and select English or Telugu. Type a question and select Send. Source buttons open the relevant parcel or user guide.

AI uses OpenRouter through the server. Your question and selected synthetic source records are sent to the provider. Never include confidential information. The assistant explains records and steps; it cannot submit, approve or change anything.

If AI is unavailable, the app clearly labels its response as Local guide and shows the connection problem. It does not pretend the local response came from an AI model.

For setup, add OPENROUTER_API_KEY in the bhoomi-landstack Render service’s Environment, then save and deploy. An optional OPENROUTER_MODEL selects another valid text model; the default openrouter/free uses the free router. Platform administrator can select Test server key. Invalid-key, credit, permission, rate-limit, model and timeout errors have specific recovery steps.

## 2. Choose your workspace

Select Enter workspace. Citizen demo is a quick visit. Create a citizen account if you want to return to the same requests after signing out; use a test email and a password of at least 10 characters.

For officer access, choose a department and state jurisdiction, then select Officer demo. Revenue handles area, rights and disputes. Registration handles the first registration stage. Planning handles building reviews. Tax & valuation handles fiscal stages. Platform administrator can review all demo departments, import data and process integration events.

Select Switch workspace to change demo roles. Keep the citizen in a normal browser window and officers in a separate private/incognito window. Tabs in one browser profile share the same login.

## 3. Explore a parcel

Open Parcel explorer. Choose Karnataka, Tamil Nadu or Andhra Pradesh and Urban or Rural. Search a parcel ID, survey number or sample rights holder. Start with URB-002.

Click the polygon or directory entry. Overview shows area, rights holder, tax, permissions and indicators. Records compares independent departmental sources. Spatial shows synthetic overlay intersections and illustrative valuation. History shows applications and decisions.

Turn on Restriction zones and Utility corridors above the map. Save a parcel with the bookmark icon. Use Export GeoJSON or Download parcel summary when you need a copy. Geometry area and recorded area are separate; neither establishes surveyed boundaries.

## 4. Submit and track a request

Sign in as a citizen, open a parcel and select Request a service. Choose the service and review its department route. Fill the requested area, new sample rights holder or proposed use when relevant.

Add an optional sample evidence reference and 10–2,000 characters of supporting details. References are text only; documents are not uploaded or verified. Submit and keep your tracking reference.

My applications shows each stage, department decision and demonstration target date. The notification bell shows updates. Download a JSON receipt if needed. You may withdraw a request before its first review. Final decisions cannot be edited.

Citizen demo sessions last 24 hours. Switching demo roles creates a different identity. Use a registered citizen account if you need to return to your previous requests.

## 5. Review as an officer

Choose the assigned department and matching state. Open Service queue, find the tracking reference and select Review application. Compare the request with the current parcel. Choose Approved or Rejected and enter a reason of at least 10 characters.

Area correction uses Revenue and updates the approved area and record version together. Ownership and building enquiries record answers; they do not issue certificates. Tax assessment review records a decision without collecting money or waiving dues.

Registration & mutation follows Registration → Revenue → Tax. Registration approval alone does not change the rights holder. The change happens at the Revenue stage; Tax completes the workflow. Switch to the next department after each review.

Building permission follows Planning → Tax. Planning must acknowledge zoning and restriction review. A conservation designation blocks a demo building approval. Dispute report and Dispute resolution use Revenue to set or clear the synthetic dispute flag.

Any approval on a disputed parcel requires explicit acknowledgement. A stale parcel version or a repeated final decision is blocked. Reject a stale request with a reason and submit a fresh one.

## 6. Import a state dataset

Choose Platform administrator demo and open Data exchange. Select a state adapter, then Load sample template, or open a JSON file below 900 KB.

Use a new synthetic identifier beginning DEMO- with uppercase letters, numbers and hyphens. Change it if that sample identifier already exists. Click Validate & preview and fix every error.

Tamil Nadu hectares are multiplied by 10,000; Andhra Pradesh acres by 4,046.8564224; Karnataka uses square metres. Check the normalized preview, then Import dataset. The new parcel appears in the explorer and its batch in Import history.

Maximum 200 rows per batch. Duplicate IDs, missing fields and invalid coordinate rings block the batch. Import is transactional and never overwrites existing parcels. These adapters demonstrate configurable formats; they are not official state API schemas.

## 7. Simulate an outage and retry

Approve a review stage to create a department delivery event. As Platform administrator, open Department sync.

Select Simulate outage on a pending event. It becomes Failed and retains its attempt count and explanation. Select Retry delivery to update the corresponding local mock source record.

Process pending handles up to 10 events at a time. Delivered events are not replayed. Older source versions cannot replace newer deliveries. An adapter failure does not undo a committed officer decision. No government API is contacted.

## 8. Use governance insights

Filter by state to inspect land-use counts, dispute flags, illustrative tax dues and quality findings. Service outcome counts are labelled all-state.

The checker compares area and rights-holder values across source records and flags missing rights records, disputes, tax dues, mortgages and conservation designations. Open a finding to inspect its parcel or export the quality report.

These are deterministic review indicators, not fraud predictions, ownership decisions or legal conclusions. Conflicting values remain visible instead of being silently replaced.

## 9. Run a ten-minute demo

Minutes 1–2: explore URB-002, the source records and map overlays. Minutes 3–4: submit Registration & mutation as a citizen with a new sample rights holder.

Minutes 5–6: approve in Registration, then Revenue, then Tax. Show that the rights holder changes only at Revenue. Minute 7: show the citizen timeline, notifications and parcel history.

Minute 8: simulate a delivery outage and retry it. Minute 9: preview a Tamil Nadu import and its hectare conversion. Minute 10: show source conflicts and explain the real-world integration boundaries.

## 10. Fix common problems

First visit is slow: the free hosting service may be waking; allow time and refresh. No request in an officer queue: use the assigned department and state, or administrator demo.

Approval blocked: check dispute acknowledgement, conservation rules, current department and parcel version. Duplicate import: use a new DEMO- identifier; existing parcels are protected.

Source values still differ: inspect Department sync and deliver pending events, or investigate the independent source. Request missing after a role switch: sign back into the registered citizen account.

Map tiles unavailable: use the searchable parcel directory. The basemap depends on an external provider. Do not repeat a submission immediately; check My applications first.

## 11. Know the boundaries

Bhoomi is a functioning SIH26014 prototype with synthetic parcels, public demo departments and local mock adapters. It does not provide legal-title verification, official ULPIN issuance, government transactions, document uploads, payments, satellite change detection or a trained predictive model.

Platform & standards links to the API specification and experimental OGC-style feature discovery/query interface. Formal OGC conformance testing and certification have not been completed.

A real rollout needs authorized cadastral data and department connectors, verified identities, approved state rules, jurisdiction access, production backups and recovery, and independent security, accessibility and data-protection review.
