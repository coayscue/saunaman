// Validate: end date field on events
import { chromium } from "playwright";
import { mkdirSync, appendFileSync } from "node:fs";

const RUN_DIR = process.env.RUN_DIR || ".validation/_adhoc";
const SHOTS = `${RUN_DIR}/screenshots`;
const BASE = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_PATH = "/admin-secret-dashboard-254";
const EVENT_NAME = "Validation End Date Event";
const START = "2026-12-15T10:00";
const END = "2026-12-15T12:00";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: false, slowMo: 200 });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

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
  // 1. Open admin dashboard
  await page.goto(BASE + ADMIN_PATH);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "+ Create Event" }).first().waitFor();
  await shot("admin-dashboard");

  // 2. Open create-event modal
  await page.getByRole("button", { name: "+ Create Event" }).first().click();
  const modal = page.locator(".modal");
  await modal.getByText("Create Event").first().waitFor();

  // 3. Fill the form (including the new End Date & Time field)
  await modal.locator('input[type="text"]').first().fill(EVENT_NAME);
  const dts = modal.locator('input[type="datetime-local"]');
  await dts.nth(0).fill(START);          // Date & Time
  await dts.nth(1).fill(END);            // End Date & Time (new field)
  await modal.locator('input[step="0.01"]').fill("55");      // Price
  // number inputs: duration (first), max_capacity (last)
  await modal.locator('input[type="number"]').last().fill("10"); // Max Capacity
  await shot("create-form-with-end-date");

  // 4. Submit and wait for the POST to succeed
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/events") && r.request().method() === "POST"),
    modal.getByRole("button", { name: "Create Event" }).click(),
  ]);
  console.log("POST /api/events status:", resp.status());
  await page.waitForLoadState("networkidle");
  await shot("after-create-agenda");

  // 5. Open the event detail modal -> should show an End Date row
  await page.locator("tr", { hasText: EVENT_NAME }).first().click();
  await page.getByText("Event Details").first().waitFor();
  await shot("admin-event-detail-end-date");
  // close
  await page.locator(".modal-close").first().click();

  // 6. Calendar tab
  await page.getByRole("button", { name: /^Calendar$/ }).click();
  await page.waitForTimeout(500);
  await shot("admin-calendar");

  // 7. Public Home card -> should show "Ends:" line
  await page.goto(BASE + "/");
  await page.waitForLoadState("networkidle");
  const card = page.locator(".event-card", { hasText: EVENT_NAME });
  await card.first().scrollIntoViewIfNeeded();
  await shot("home-card-end-date");

  // 8. BookEvent page -> should show start – end range
  await card.first().getByRole("button", { name: "Book Now" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("heading", { name: new RegExp("Book: " + EVENT_NAME) }).waitFor();
  await shot("book-event-end-range");

  console.log("FLOW_OK");
} catch (err) {
  await shot("error-state");
  console.error("FLOW_FAILED:", err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
