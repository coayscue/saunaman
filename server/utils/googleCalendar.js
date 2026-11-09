const crypto = require("crypto");
const { google } = require("googleapis");
google.options({ timeout: 15000 });
const Connection = require("../models/CalendarConnection");
function oauth() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) throw new Error("Google OAuth is not configured");
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
}
function key() {
  const value = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("Calendar encryption key is not configured");
  return Buffer.from(value, "hex");
}
function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const bytes = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), bytes].map(b => b.toString("base64")).join(".");
}
function decrypt(value) {
  const [iv, tag, bytes] = value.split(".").map(v => Buffer.from(v, "base64"));
  const cipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(bytes), cipher.final()]).toString("utf8");
}
async function query(auth, calendarId, start, end) {
  const { data } = await google.calendar({ version: "v3", auth }).freebusy.query({ requestBody: {
    timeMin: start.toISOString(), timeMax: end.toISOString(), timeZone: "America/Los_Angeles", items: [{ id: calendarId }],
  }});
  const result = data.calendars?.[calendarId];
  if (!result || result.errors?.length) throw new Error("Cannot read the configured calendar");
  return (result.busy || []).map(b => ({ date: b.start, duration: (new Date(b.end) - new Date(b.start)) / 60000 }));
}
async function busy(start, end) {
  const connection = await Connection.findById("saunaman");
  if (!connection || connection.status !== "connected") throw new Error("Calendar connection unavailable");
  const auth = oauth();
  auth.setCredentials({ refresh_token: decrypt(connection.token) });
  try { return await query(auth, connection.calendarId, start, end); }
  catch (error) {
    if (error.response?.data?.error === "invalid_grant") await Connection.updateOne({ _id: "saunaman" }, { status: "reconnect_required" });
    throw error;
  }
}
module.exports = { oauth, encrypt, decrypt, query, busy };

async function eventClient() {
  const connection = await Connection.findById('saunaman');
  if (!connection || connection.status !== 'connected') throw new Error('Reconnect Google Calendar');
  const auth = oauth(); auth.setCredentials({ refresh_token: decrypt(connection.token) });
  return { api: google.calendar({ version: 'v3', auth }), calendarId: connection.calendarId };
}
async function ensureBookingEvent(request) {
  const { api, calendarId } = await eventClient();
  if (request.calendarId && request.calendarId !== calendarId) throw new Error('Calendar changed during processing');
  const id = crypto.createHash('sha256').update(request._id).digest('hex');
  try {
    const { data } = await api.events.get({ calendarId, eventId: id });
    if (data.extendedProperties?.private?.bookingRequestId !== request._id || data.status === 'cancelled') throw new Error('Calendar event requires manual review');
    return { id, calendarId };
  } catch (e) { if (Number(e.code) !== 404) throw e; }
  if ((await busy(request.start, request.end)).length) { const e = new Error('Calendar conflict'); e.conflict = true; throw e; }
  try {
    await api.events.insert({ calendarId, requestBody: { id, summary: `Private Sauna - ${request.customer.name}`, start: { dateTime: request.start.toISOString(), timeZone: 'America/Los_Angeles' }, end: { dateTime: request.end.toISOString(), timeZone: 'America/Los_Angeles' }, location: request.location.address, transparency: 'opaque', extendedProperties: { private: { bookingRequestId: request._id } } } });
  } catch (e) {
    if (Number(e.code) !== 409) throw e;
    const { data } = await api.events.get({ calendarId, eventId: id });
    if (data.extendedProperties?.private?.bookingRequestId !== request._id || data.status === 'cancelled') throw new Error('Calendar event requires manual review');
  }
  return { id, calendarId };
}
async function removeBookingEvent(request) {
  const { api, calendarId } = await eventClient();
  if (request.calendarId && calendarId !== request.calendarId) throw new Error('Reconnect original calendar to finish cancellation');
  const id = crypto.createHash('sha256').update(request._id).digest('hex');
  try { await api.events.delete({ calendarId, eventId: id }); }
  catch (e) { if (![404,410].includes(Number(e.code))) throw e; }
}
module.exports.ensureBookingEvent = ensureBookingEvent;
module.exports.removeBookingEvent = removeBookingEvent;

module.exports.eventClient = eventClient;
