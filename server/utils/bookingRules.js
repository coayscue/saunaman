const { DateTime } = require('luxon');
function validateBooking(body) {
  const { name, email, phone, tentCount, duration, date, waiverAccepted } = body;
  const start = DateTime.fromISO(date || '', { zone: 'America/Los_Angeles' }).setZone('America/Los_Angeles');
  if (!name?.trim() || name.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '') || email.length > 254 || !phone?.trim() || phone.length > 60 || waiverAccepted !== true) throw new Error('Customer details and accepted waiver are required');
  if (![1, 2].includes(tentCount) || ![2, 3, 4].includes(duration) || !start.isValid || start.toMillis() - Date.now() < 36 * 3600000 || start.minute || start.second || start.millisecond) throw new Error('Invalid session or less than 36 hours notice');
  const weekend = start.weekday >= 6;
  if (start.hour < (weekend ? 9 : 17) || start.hour + duration > (weekend ? 20 : 21)) throw new Error('Outside booking hours');
  const base = tentCount === 2 ? 700 : 450;
  return { start: start.toJSDate(), end: start.plus({ hours: duration }).toJSDate(), amountCents: Math.round(base * (duration === 4 ? 2 : duration === 3 ? 1.5 : 1) * 100) };
}
function lockKeys(start, end) {
  const keys = [];
  for (let t = +start; t < +end; t += 3600000) keys.push(String(t));
  return keys;
}
function verifyIntent(request, intent) {
  if (intent.id !== request.paymentIntentId || intent.metadata?.bookingRequestId !== request._id || intent.amount !== request.amountCents || intent.currency !== 'usd' || intent.capture_method !== 'manual') throw new Error('Payment does not match request');
}
function decisionDeadline(intent, now = Date.now()) {
  const before = intent.latest_charge?.payment_method_details?.card?.capture_before;
  return new Date(Math.min(now + 24 * 3600000, before ? before * 1000 - 3600000 : now + 3600000));
}
function shouldAutoApproveTest(intent, env = process.env) {
  const card = intent.latest_charge?.payment_method_details?.card;
  return env.STRIPE_AUTO_APPROVE_TEST_BOOKINGS === 'true' && env.NODE_ENV !== 'production' &&
    intent.livemode === false && intent.status === 'requires_capture' &&
    card?.brand === 'visa' && card?.last4 === '4242';
}
module.exports = { validateBooking, lockKeys, verifyIntent, decisionDeadline, shouldAutoApproveTest };
