import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
const output = path.resolve("../../outputs/Bhoomi-User-Guide.pdf");
await mkdir(path.dirname(output), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 900 },
    reducedMotion: "reduce",
  });
  await page.goto(
    (process.env.TEST_BASE_URL || "http://127.0.0.1:3002") + "/#guide",
  );
  await page
    .getByRole("heading", { name: "Know the boundaries", exact: true })
    .waitFor();
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: output,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    preferCSSPageSize: true,
    headerTemplate:
      '<div style="font-family:Arial;font-size:8px;color:#7c8a71;margin-left:60px">BHOOMI LAND STACK · USER GUIDE</div>',
    footerTemplate:
      '<div style="font-family:Arial;font-size:8px;color:#7c8a71;margin:0 60px;width:100%;display:flex;justify-content:space-between"><span>Synthetic SIH26014 demonstration · Version 2</span><span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
  });
  console.log("Guide PDF exported.");
} finally {
  await browser.close();
}
