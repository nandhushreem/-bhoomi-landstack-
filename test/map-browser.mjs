import { chromium, expect as baseExpect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fixtureMap, mapFixture } from "./map-fixture.mjs";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3006";
const live = process.env.MAP_LIVE === "1";
const expect = baseExpect.configure({ timeout: 30000 });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [],
  violations = [],
  mapResponses = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  window.mapPolicyViolations = [];
  document.addEventListener("securitypolicyviolation", (e) =>
    window.mapPolicyViolations.push(e.violatedDirective + ": " + e.blockedURI),
  );
});
page.on("response", (r) => {
  if (r.url().startsWith("https://tiles.openfreemap.org/"))
    mapResponses.push({ url: r.url(), status: r.status() });
});
await mkdir("test-results", { recursive: true });
try {
  if (!live) await fixtureMap(context);
  // Never request the volunteer OSM raster service, even on regressions.
  await context.route(
    /https:\/\/([a-z]\.)?tile\.openstreetmap\.org\//,
    (route) => {
      errors.push("Unexpected legacy OSM raster request");
      return route.abort();
    },
  );
  const response = await page.goto(base);
  assert.equal(
    response.headers()["referrer-policy"],
    "strict-origin-when-cross-origin",
  );
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-basemap-status",
    "ready",
    { timeout: 30000 },
  );
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(
    page.locator(".leaflet-overlay-pane path").first(),
  ).toBeVisible();
  await expect(page.locator(".leaflet-control-attribution")).toContainText(
    "OpenFreeMap",
  );
  assert.ok(mapResponses.length > 0);
  assert.ok(
    mapResponses.every((r) => r.status === 200),
    JSON.stringify(mapResponses),
  );
  violations.push(...(await page.evaluate(() => window.mapPolicyViolations)));
  await page.screenshot({
    path: `test-results/map-${live ? "live" : "fixture"}.png`,
    fullPage: true,
  });

  if (!live) {
    await page.getByRole("button", { name: "URB-002", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Request a service", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Restriction zones", { exact: true }).check();
    // Switching screens disposes the renderer, then creates a fresh instance.
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "How to use Bhoomi", exact: true })
      .click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Parcel explorer", exact: true })
      .click();
    await expect(page.locator(".map-canvas")).toHaveAttribute(
      "data-basemap-status",
      "ready",
    );

    const failed = await context.newPage();
    failed.on("pageerror", (e) => errors.push(e.message));
    let blocked = true;
    await failed.route("https://tiles.openfreemap.org/**", (route) =>
      blocked
        ? route.fulfill({ status: 403, body: "Access blocked" })
        : route.fulfill({ json: mapFixture }),
    );
    await failed.goto(base);
    await expect(failed.locator(".map-canvas")).toHaveAttribute(
      "data-basemap-status",
      "unavailable",
    );
    await expect(failed.getByRole("status")).toContainText(
      "Parcel records and boundaries are still available",
    );
    await expect(failed.locator(".maplibregl-canvas")).toHaveCount(0);
    await failed.getByRole("button", { name: "URB-002", exact: true }).click();
    await expect(
      failed.getByRole("button", { name: "Request a service", exact: true }),
    ).toBeVisible();
    await failed.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await failed.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await expect(
      failed.getByRole("button", { name: "Retry map", exact: true }),
    ).toBeVisible();
    await failed.screenshot({
      path: "test-results/map-mobile-fallback.png",
      fullPage: true,
    });
    blocked = false;
    await failed
      .getByRole("button", { name: "Retry map", exact: true })
      .click();
    await expect(failed.locator(".map-canvas")).toHaveAttribute(
      "data-basemap-status",
      "ready",
    );
    await expect(
      failed.getByRole("button", { name: "Retry map", exact: true }),
    ).toHaveCount(0);
    await failed.close();

    const unsupported = await context.newPage();
    unsupported.on("pageerror", (e) => errors.push(e.message));
    await unsupported.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return kind.startsWith("webgl")
          ? null
          : original.call(this, kind, ...args);
      };
    });
    await unsupported.goto(base);
    await expect(unsupported.locator(".map-canvas")).toHaveAttribute(
      "data-basemap-status",
      "unavailable",
    );
    await unsupported
      .getByRole("button", { name: "URB-002", exact: true })
      .click();
    await expect(
      unsupported.getByRole("button", {
        name: "Request a service",
        exact: true,
      }),
    ).toBeVisible();
    await unsupported.close();
  }
  assert.deepEqual(violations, []);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      mode: live
        ? "live initial viewport"
        : "fixture + 403 recovery + navigation + mobile",
      mapRequests: mapResponses.length,
      pageErrors: errors,
      policyViolations: violations,
    }),
  );
} catch (error) {
  await page.screenshot({
    path: "test-results/map-failure.png",
    fullPage: true,
  });
  console.error({
    errors,
    violations,
    mapResponses,
    status: await page
      .locator(".map-canvas")
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.basemapStatus)),
  });
  throw error;
} finally {
  await browser.close();
}
