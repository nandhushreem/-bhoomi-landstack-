import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pool } from "../server/db.js";
import { sourceRecords } from "../server/seed.js";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  }),
  staff = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
const page = await ctx.newPage(),
  off = await staff.newPage(),
  errors = [],
  users = [],
  requests = [],
  importIds = [],
  batchIds = [];
let baseline, fixtureId;
for (const p of [page, off]) p.on("pageerror", (e) => errors.push(e.message));
await mkdir("test-results", { recursive: true });
async function role(dept) {
  const button = off.getByTitle("Switch workspace", { exact: true });
  if (await button.count()) await button.click();
  else
    await off
      .getByRole("button", { name: "Enter workspace", exact: true })
      .click();
  await off.getByLabel("Demo department", { exact: true }).selectOption(dept);
  await off.getByRole("button", { name: /Officer demo/ }).click();
  await off.getByRole("dialog").waitFor({ state: "hidden" });
  users.push(
    (await (await staff.request.get(base + "/api/auth/me")).json()).user.id,
  );
}
async function decide(reason) {
  const card = off
    .locator(".application-card")
    .filter({ hasText: requests[0] });
  await card.getByRole("button", { name: "Review application" }).click();
  await off.getByLabel("Reason for decision").fill(reason);
  await off
    .getByRole("button", { name: "Record decision", exact: true })
    .click();
  await off.getByRole("dialog").waitFor({ state: "hidden" });
}
try {
  await page.goto(base);
  await page.getByRole("button", { name: "URB-002", exact: true }).waitFor();
  baseline = (
    await (await ctx.request.get(base + "/api/parcels")).json()
  ).parcels.find((p) => p.id === "URB-002");
  fixtureId = "DEMO-KA-UI-" + Date.now();
  const { checks, ...original } = baseline;
  const testParcel = {
    ...original,
    id: fixtureId,
    demo_identifier: fixtureId,
    owner: "Browser Sample Citizen",
  };
  await pool.query("INSERT INTO bhoomi.parcels(id,data) VALUES($1,$2)", [
    fixtureId,
    testParcel,
  ]);
  importIds.push(fixtureId);
  for (const r of sourceRecords(testParcel, 1))
    await pool.query(
      "INSERT INTO bhoomi.source_records(id,parcel_id,domain,department,source,record_values) VALUES($1,$2,$3,$4,$5,$6)",
      [r.id, r.parcel_id, r.domain, r.department, r.source, r.values],
    );
  await page.getByLabel("State pilot").selectOption("TN");
  await page.getByRole("button", { name: "TN-URB-002", exact: true }).waitFor();
  await page.getByLabel("State pilot").selectOption("KA");
  await page.getByLabel("Restriction zones", { exact: true }).check();
  await page.getByLabel("Utility corridors", { exact: true }).check();
  await page.screenshot({
    path: "test-results/v2-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Enter workspace", exact: true })
    .click();
  await page.getByRole("button", { name: /Citizen demo/ }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  users.push(
    (await (await ctx.request.get(base + "/api/auth/me")).json()).user.id,
  );
  await page.getByLabel("Search parcels").fill(fixtureId);
  await page.getByRole("button", { name: fixtureId, exact: true }).click();
  await page
    .getByRole("button", { name: "Request a service", exact: true })
    .click();
  await page
    .locator('select[name="service"]')
    .selectOption("Registration & mutation");
  await page
    .getByLabel("New synthetic rights holder")
    .fill("Browser Sample Holder");
  await page
    .getByLabel("Supporting details")
    .fill("Synthetic browser verification for department handoffs.");
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Your requests, in view." })
    .waitFor();
  const list = await (await ctx.request.get(base + "/api/applications")).json();
  requests.push(list.applications[0].id);
  await off.goto(base);
  await off
    .getByRole("button", { name: "Enter workspace", exact: true })
    .waitFor();
  await role("registration");
  await decide(
    "Registration evidence reviewed in automated browser verification.",
  );
  assert.equal(
    (await (await ctx.request.get(base + "/api/parcels")).json()).parcels.find(
      (p) => p.id === fixtureId,
    ).owner,
    "Browser Sample Citizen",
  );
  await role("revenue");
  await decide("Revenue mutation reviewed in automated browser verification.");
  await role("fiscal");
  await decide(
    "Fiscal acknowledgement reviewed in automated browser verification.",
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .locator(".application-card")
    .filter({ hasText: requests[0] })
    .getByText("Approved", { exact: true })
    .first()
    .waitFor();
  await page.screenshot({
    path: "test-results/v2-requests.png",
    fullPage: true,
  });
  await role("administrator");
  await off.getByRole("button", { name: "Data exchange", exact: true }).click();
  await off
    .getByRole("button", { name: "Load sample template", exact: true })
    .click();
  await off.getByLabel("Source dataset JSON").waitFor();
  await off.waitForFunction(() =>
    document.querySelector(".json-editor")?.value.includes("records"),
  );
  const template = JSON.parse(
    await off.getByLabel("Source dataset JSON").inputValue(),
  );
  template.records[0].parcel_ref = "DEMO-TN-BROWSER-" + Date.now();
  await off
    .getByLabel("Source dataset JSON")
    .fill(JSON.stringify(template, null, 2));
  await off
    .getByRole("button", { name: "Validate & preview", exact: true })
    .click();
  await off
    .getByRole("heading", { name: "Validation passed", exact: true })
    .waitFor();
  const importResponse = off.waitForResponse(
    (r) =>
      r.url().endsWith("/api/exchange/import") &&
      r.request().method() === "POST",
  );
  await off
    .getByRole("button", { name: "Import dataset", exact: true })
    .click();
  const result = await (await importResponse).json();
  importIds.push(template.records[0].parcel_ref);
  batchIds.push(result.batch);
  await off.getByText("Import history", { exact: true }).waitFor();
  await off.screenshot({
    path: "test-results/v2-exchange.png",
    fullPage: true,
  });
  await off
    .getByRole("button", { name: "Department sync", exact: true })
    .click();
  await off
    .getByRole("heading", { name: "Department delivery log", exact: true })
    .waitFor();
  await off.screenshot({
    path: "test-results/v2-integrations.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Governance insights", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Explainable data quality", exact: true })
    .waitFor();
  await page.screenshot({
    path: "test-results/v2-insights.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "Parcel explorer", exact: true })
    .click();
  await page.getByRole("button", { name: "URB-002", exact: true }).click();
  await page.screenshot({ path: "test-results/v2-mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "How to use Bhoomi", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Run a ten-minute demo", exact: true })
    .waitFor();
  await page.screenshot({
    path: "test-results/v2-guide-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: desktop/mobile explorer, multi-state filters, overlays, citizen registration request, three department approvals, admin import preview/commit, integration console, quality dashboard and built-in guide; no browser runtime errors.",
  );
} catch (e) {
  await page.screenshot({
    path: "test-results/v2-failure-citizen.png",
    fullPage: true,
  });
  await off.screenshot({
    path: "test-results/v2-failure-officer.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    if (requests.length) {
      await c.query(
        "DELETE FROM bhoomi.notifications WHERE application_id=ANY($1::text[])",
        [requests],
      );
      await c.query(
        "DELETE FROM bhoomi.integration_events WHERE application_id=ANY($1::text[])",
        [requests],
      );
      await c.query(
        "DELETE FROM bhoomi.tasks WHERE application_id=ANY($1::text[])",
        [requests],
      );
      await c.query(
        "DELETE FROM bhoomi.audit WHERE application_id=ANY($1::text[])",
        [requests],
      );
      await c.query(
        "DELETE FROM bhoomi.applications WHERE id=ANY($1::text[])",
        [requests],
      );
    }
    if (importIds.length) {
      await c.query(
        "DELETE FROM bhoomi.audit WHERE parcel_id=ANY($1::text[])",
        [importIds],
      );
      await c.query(
        "DELETE FROM bhoomi.source_records WHERE parcel_id=ANY($1::text[])",
        [importIds],
      );
      await c.query("DELETE FROM bhoomi.parcels WHERE id=ANY($1::text[])", [
        importIds,
      ]);
    }
    if (batchIds.length)
      await c.query(
        "DELETE FROM bhoomi.import_batches WHERE id=ANY($1::uuid[])",
        [batchIds],
      );
    if (users.length) {
      await c.query(
        "DELETE FROM bhoomi.sessions WHERE user_id=ANY($1::uuid[])",
        [users],
      );
      await c.query("DELETE FROM bhoomi.users WHERE id=ANY($1::uuid[])", [
        users,
      ]);
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}
