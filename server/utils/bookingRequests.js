const Request = require('../models/BookingRequest');
const Lock = require('../models/BookingSlotLock');
const Event = require('../models/Event');
const User = require('../models/User');
const Reservation = require('../models/Reservation');
const Payment = require('../models/Payment');
const { stripe } = require('./stripe');
const { lockKeys, verifyIntent, decisionDeadline, shouldAutoApproveTest } = require('./bookingRules');
const calendar = require('./googleCalendar');
const { notify } = require('./bookingRequestEmail');
const terminal = ['confirmed','denied','expired'];
async function acquire(request) {
  try {
    for (const id of lockKeys(request.start, request.end)) {
      try { await Lock.create({ _id: id, requestId: request._id, date: new Date(Number(id)) }); }
      catch (e) { if (e.code !== 11000 || (await Lock.findById(id))?.requestId !== request._id) throw e; }
    }
  } catch (e) { await Lock.deleteMany({ requestId: request._id }); throw new Error('This time is already held by another request'); }
}
async function localConflict(request) {
  return Event.exists({ type: 'private', booked: true, _id: { $ne: request._id }, date: { $lt: request.end }, $expr: { $gt: [{ $add: ['$date', { $multiply: [{ $ifNull: ['$duration',120] },60000] }] },request.start] } });
}
async function intentFor(request) {
  if (!request.paymentIntentId) {
    // Stable idempotency key recovers creation if the process stopped before saving the ID.
    const intent = await stripe.paymentIntents.create({ amount: request.amountCents, currency: 'usd', payment_method_types: ['card'], capture_method: 'manual', metadata: { bookingRequestId: request._id } }, { idempotencyKey: `request-${request._id}` });
    request.paymentIntentId = intent.id; await request.save();
  }
  const intent = await stripe.paymentIntents.retrieve(request.paymentIntentId, { expand: ['latest_charge'] });
  verifyIntent(request, intent); return intent;
}
async function settleRelease(request, intent) {
  if (intent.status === 'succeeded') await stripe.refunds.create({ payment_intent: intent.id }, { idempotencyKey: `release-${request._id}` });
  else if (intent.status !== 'canceled') await stripe.paymentIntents.cancel(intent.id, {}, { idempotencyKey: `release-${request._id}` });
  if (request.googleEventId) await calendar.removeBookingEvent(request);
  request.paymentStatus = intent.status === 'succeeded' ? 'refunded' : 'canceled';
  request.status = request.status === 'denying' ? 'denied' : 'expired';
  request.lastError = ''; await request.save();
  await Lock.deleteMany({ requestId: request._id });
}
async function confirmRecords(request) {
  const user = await User.findOneAndUpdate({ email: request.customer.email }, { $set: { name: request.customer.name, phone: request.customer.phone, signedWaiver: true } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  await Event.updateOne({ _id: request._id }, { $setOnInsert: { name: `Private Sauna - ${request.customer.name}`, date: request.start, duration: request.duration * 60, price: request.amountCents / 100, max_capacity: request.tentCount === 2 ? 24 : 12, type: 'private', booked: true, syncEnabled: true, syncStatus: 'pending', googleEventId: request.googleEventId, googleCalendarId: request.calendarId, syncBase: JSON.stringify({name: `Private Sauna - ${request.customer.name}`, start:request.start.toISOString(), end:request.end.toISOString(), location:request.location.address || ''}), tent_count: request.tentCount, location: request.location } }, { upsert: true });
  await Reservation.updateOne({ _id: request._id }, { $setOnInsert: { event: request._id, user: user._id } }, { upsert: true });
  await Payment.updateOne({ _id: request._id }, { $setOnInsert: { amount: request.amountCents / 100, stripe_payment_id: request.paymentIntentId, reservation: request._id } }, { upsert: true });
  request.status = 'confirmed'; request.paymentStatus = 'succeeded'; request.lastError = ''; await request.save();
  await Lock.deleteMany({ requestId: request._id });
}
async function processRequest(id) {
  const owner = require('crypto').randomUUID();
  const request = await Request.findOneAndUpdate({ _id: id, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: null }, { leaseUntil: { $lt: new Date() } }] }, { $set: { leaseUntil: new Date(Date.now()+300000), leaseOwner: owner } }, { new: true });
  if (!request) return;
  try {
    if (!terminal.includes(request.status)) {
      if (request.status === 'checkout') {
        try { await acquire(request); }
        catch { request.status = 'expiring'; await request.save(); }
      }
      const intent = await intentFor(request);
      request.paymentStatus = intent.status;
      if (request.status === 'checkout' && intent.status === 'requires_capture') {
        request.deadline = decisionDeadline(intent); request.status = 'pending'; await request.save();
      }
      if (['checkout','pending'].includes(request.status) && (request.deadline <= new Date() || intent.status === 'canceled')) { request.status = 'expiring'; await request.save(); }
      if (request.status === 'pending' && request.autoApproveTest && shouldAutoApproveTest(intent)) {
        request.status = 'approving'; request.autoApproved = true; await request.save();
      }
      if (request.status === 'approving') {
        if (intent.status === 'succeeded') await confirmRecords(request);
        else if (intent.status !== 'requires_capture' || request.deadline <= new Date()) { request.status = 'expiring'; await request.save(); }
        else {
          if (await localConflict(request)) { request.status = 'denying'; await request.save(); }
          else {
            try {
              // Persist deterministic event linkage BEFORE creating it, so compensation can recover a crash.
              request.googleEventId = require('crypto').createHash('sha256').update(request._id).digest('hex');
              if (!request.calendarId) request.calendarId = (await require('../models/CalendarConnection').findById('saunaman'))?.calendarId;
              await request.save();
              await calendar.ensureBookingEvent(request);
              await stripe.paymentIntents.capture(intent.id, {}, { idempotencyKey: `capture-${request._id}` });
              await confirmRecords(request);
            } catch (e) {
              if (e.conflict) { request.status = 'denying'; await request.save(); }
              else throw e; // Retain lock and retry; never guess whether capture succeeded.
            }
          }
        }
      }
      if (['denying','expiring'].includes(request.status)) await settleRelease(request, await intentFor(request));
    }
    if (terminal.includes(request.status)) await Lock.deleteMany({ requestId: request._id });
    if (['pending',...terminal].includes(request.status) && request.noticeStatus !== request.status) {
      await notify(request); request.noticeStatus = request.status; await request.save();
    }
  } catch (e) { request.lastError = 'Processing needs attention or retry. Check payment, calendar permissions and email configuration.'; await request.save(); }
  finally { await Request.updateOne({ _id: id, leaseOwner: owner }, { $unset: { leaseUntil: 1, leaseOwner: 1 } }); }
}
let running = false;
async function tick() {
  if (running) return; running = true;
  try {
    const requests = await Request.find({ $or: [{ status: { $nin: terminal } }, { $expr: { $ne: ['$noticeStatus','$status'] } }] }).sort({ updatedAt: 1 }).limit(100);
    for (const request of requests) await processRequest(request._id);
  } catch { console.error('Booking request worker failed; will retry'); }
  finally { running = false; }
}
module.exports = { acquire, localConflict, intentFor, processRequest, tick };
