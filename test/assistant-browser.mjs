import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pool } from "../server/db.js";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3005";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  }),
  page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let userId;
await mkdir("test-results", { recursive: true });
try {
  await page.goto(base + "/#assistant");
  await page
    .getByRole("heading", { name: "Land records, explained.", exact: true })
    .waitFor();
  await page.getByLabel("Ask Bhoomi AI", { exact: true }).waitFor();
  const before = await (
    await context.request.get(base + "/api/ai/status")
  ).json();
  assert.equal(typeof before.configured, "boolean");
  assert.equal(JSON.stringify(before).includes("sk-or-"), false);
  await page
    .getByLabel("Ask Bhoomi AI", { exact: true })
    .fill("What is the recorded area of this parcel? Answer briefly.");
  await page
    .getByRole("button", { name: "Enter workspace to ask", exact: true })
    .click();
  await page.getByRole("button", { name: /Citizen demo/ }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  userId = (await (await context.request.get(base + "/api/auth/me")).json())
    .user.id;
  await page
    .getByRole("heading", { name: "Land records, explained.", exact: true })
    .waitFor();
  await page.getByLabel("AI parcel context").selectOption("URB-002");
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/ai/chat") && r.request().method() === "POST",
    { timeout: 60000 },
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const r = await response,
    j = await r.json();
  assert.equal(r.status(), 200);
  assert.ok(j.answer.length > 20);
  assert.ok(j.sources.some((s) => s.parcel_id === "URB-002"));
  await page.locator(".chat-message.assistant").last().waitFor();
  if (process.env.REQUIRE_AI === "1")
    assert.equal(j.mode, "ai", JSON.stringify(j.providerProblem));
  if (j.mode === "local") {
    await page
      .getByText("Bhoomi local guide · not AI-generated", { exact: true })
      .waitFor();
    assert.ok(j.providerProblem?.code);
  } else
    await page.getByText("Bhoomi AI · OpenRouter", { exact: true }).waitFor();
  console.log(
    JSON.stringify({
      configured: before.configured,
      mode: j.mode,
      problem: j.providerProblem?.code || null,
      answerCharacters: j.answer.length,
      sources: j.sources.length,
    }),
  );
  await page.screenshot({
    path: "test-results/assistant-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("AI answer language").selectOption("te");
  await page
    .getByLabel("Ask Bhoomi AI", { exact: true })
    .fill("Registration & mutation ఎలా పని చేస్తుంది?");
  const second = page.waitForResponse(
    (r) => r.url().endsWith("/api/ai/chat") && r.request().method() === "POST",
    { timeout: 60000 },
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const j2 = await (await second).json();
  assert.ok(j2.answer);
  await page.locator(".chat-message.assistant").nth(1).waitFor();
  if (process.env.REQUIRE_AI === "1")
    assert.equal(j2.mode, "ai", JSON.stringify(j2.providerProblem));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/assistant-mobile.png",
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
    "PASS: AI page, guest sign-in return, actual server request, answer display, source links, Telugu selection, desktop/mobile layout, and honest provider/local mode labels.",
  );
} catch (e) {
  await page.screenshot({
    path: "test-results/assistant-failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
  if (userId) {
    await pool.query("DELETE FROM bhoomi.sessions WHERE user_id=$1", [userId]);
    await pool.query("DELETE FROM bhoomi.users WHERE id=$1", [userId]);
  }
  await pool.end();
}
