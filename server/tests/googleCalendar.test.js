const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { encrypt, decrypt } = require("../utils/googleCalendar");
process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
test("refresh tokens round trip without plaintext storage and use unique IVs", () => {
  const token = "sample-refresh-token";
  const a = encrypt(token), b = encrypt(token);
  assert.notEqual(a, b);
  assert.ok(!a.includes(token));
  assert.equal(decrypt(a), token);
});
test("tampered credentials fail authentication", () => {
  const parts = encrypt("token").split(".");
  const bytes = Buffer.from(parts[2], "base64"); bytes[0] ^= 1;
  parts[2] = bytes.toString("base64");
  assert.throws(() => decrypt(parts.join(".")));
});
test("invalid encryption configuration is rejected", () => {
  const saved = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = "invalid";
  assert.throws(() => encrypt("token"));
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = saved;
});

test("FreeBusy converts intervals and rejects calendar-level errors", async () => {
  const { google } = require("googleapis");
  const { query } = require("../utils/googleCalendar");
  const original = google.calendar;
  const start = new Date("2026-11-10T18:00:00Z");
  const end = new Date("2026-11-10T20:00:00Z");
  try {
    google.calendar = () => ({ freebusy: { query: async ({ requestBody }) => {
      assert.equal(requestBody.timeZone, "America/Los_Angeles");
      assert.deepEqual(requestBody.items, [{ id: "test-calendar" }]);
      return { data: { calendars: { "test-calendar": { busy: [{ start: start.toISOString(), end: end.toISOString() }] } } } };
    } } });
    assert.deepEqual(await query({}, "test-calendar", start, end), [{ date: start.toISOString(), duration: 120 }]);
    google.calendar = () => ({ freebusy: { query: async () => ({ data: { calendars: { "test-calendar": { errors: [{ reason: "notFound" }] } } } }) } });
    await assert.rejects(query({}, "test-calendar", start, end));
  } finally { google.calendar = original; }
});
