// Playwright UI flow template for `validate`.
// Copy to .validation/<RUN_ID>/flow.mjs and edit the STEPS for the change under test.
// Run headed:  RUN_DIR=.validation/<RUN_ID> node .validation/<RUN_ID>/flow.mjs
import { chromium } from "playwright";
import { mkdirSync, appendFileSync } from "node:fs";

const RUN_DIR = process.env.RUN_DIR || ".validation/_adhoc";
const SHOTS = `${RUN_DIR}/screenshots`;
const BASE = process.env.BASE_URL || "http://localhost:3000";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: false, slowMo: 250 });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// Forward browser console (incl. client-side [VALIDATE-DEBUG] lines) to a file.
page.on("console", (msg) =>
  appendFileSync(`${RUN_DIR}/client-console.log`, `[${msg.type()}] ${msg.text()}\n`),
);
page.on("pageerror", (err) => appendFileSync(`${RUN_DIR}/client-console.log`, `[pageerror] ${err.message}\n`));

let n = 0;
const shot = async (label) => {
  n += 1;
  const file = `${SHOTS}/${String(n).padStart(2, "0")}-${label}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log("screenshot:", file);
};

try {
  // ============ EDIT BELOW for the change under test ============
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  await shot("initial-state");

  // Example steps — replace with the real flow:
  // await page.getByRole("link", { name: "Book" }).click();
  // await shot("opened-booking");
  // await page.getByLabel("Name").fill("Validation Test");
  // await page.getByRole("button", { name: "Submit" }).click();
  // await page.waitForResponse((r) => r.url().includes("/api/") && r.ok());
  // await shot("after-submit");
  // ============ EDIT ABOVE ============

  console.log("FLOW_OK");
} catch (err) {
  await shot("error-state");
  console.error("FLOW_FAILED:", err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
