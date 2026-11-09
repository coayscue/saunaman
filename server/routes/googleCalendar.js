const crypto = require("crypto");
const Connection = require("../models/CalendarConnection");
const State = require("../models/CalendarOAuthState");
const { oauth, encrypt, query, busy } = require("../utils/googleCalendar");
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
module.exports = function(requireAdmin) {
  const router = require("express").Router();
  router.post("/connect", requireAdmin, async (req, res) => {
    try {
      const auth = oauth();
      if (!process.env.GOOGLE_CALENDAR_ID) throw new Error("Missing calendar ID");
      const state = crypto.randomBytes(32).toString("hex");
      await State.create({ _id: hash(state), expiresAt: new Date(Date.now() + 600000) });
      res.json({ url: auth.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: ["https://www.googleapis.com/auth/calendar.events.freebusy", "https://www.googleapis.com/auth/calendar.events"], state }) });
    } catch { res.status(503).json({ error: "Unable to start calendar connection. Check backend configuration." }); }
  });
  router.get("/callback", async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    try {
      if (typeof req.query.state !== "string") return res.status(400).send("Invalid authorization state.");
      const state = await State.findOneAndDelete({ _id: hash(req.query.state), expiresAt: { $gt: new Date() } });
      if (!state || req.query.error || typeof req.query.code !== "string") return res.status(400).send("Authorization expired or declined. Start again from the admin dashboard.");
      const auth = oauth();
      const { tokens } = await auth.getToken(req.query.code);
      if (!tokens.refresh_token) throw new Error("Missing refresh token");
      auth.setCredentials(tokens);
      const start = new Date();
      await query(auth, process.env.GOOGLE_CALENDAR_ID, start, new Date(start.getTime() + 86400000));
      await Connection.findOneAndUpdate({ _id: "saunaman" }, { calendarId: process.env.GOOGLE_CALENDAR_ID, token: encrypt(tokens.refresh_token), status: "connected", syncToken: null, syncError: '' }, { upsert: true });
      res.send("Google Calendar connected. Close this tab and refresh the admin dashboard.");
    } catch { res.status(503).send("Calendar connection failed. Check the calendar account, permissions and backend configuration, then reconnect."); }
  });
  router.get("/status", requireAdmin, async (req, res) => {
    try {
      const connection = await Connection.findById("saunaman");
      if (!connection) return res.json({ status: "disconnected" });
      const now = new Date();
      await busy(now, new Date(now.getTime() + 3600000));
      res.json({ status: "connected", calendarId: connection.calendarId, lastSyncedAt:connection.syncCheckedAt, syncError:connection.syncError });
    } catch { res.json({ status: "unavailable", error: "Calendar unavailable. Check access or reconnect." }); }
  });
  router.post('/sync', requireAdmin, async (req,res) => {
    await require('../utils/calendarSync').service().tick();
    const connection=await Connection.findById('saunaman');
    res.json({ lastSyncedAt:connection?.syncCheckedAt, error:connection?.syncError });
  });
  router.post("/disconnect", requireAdmin, async (req, res) => {
    try { await Connection.deleteOne({ _id: "saunaman" }); res.json({ status: "disconnected" }); }
    catch { res.status(503).json({ error: "Unable to disconnect calendar" }); }
  });
  return router;
};
