const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateBooking, lockKeys, verifyIntent, decisionDeadline } = require('../utils/bookingRules');
function valid() { return { name: 'Test', email: 'test@example.com', phone: '5551234567', waiverAccepted: true, tentCount: 1, duration: 2, date: '2099-01-03T17:00:00-08:00' }; }
test('booking validates business hours, waiver and server pricing', () => {
  const result = validateBooking(valid());
  assert.equal(result.amountCents, 45000);
  assert.equal(+result.end - +result.start, 7200000);
  assert.throws(() => validateBooking({ ...valid(), waiverAccepted: false }));
  assert.throws(() => validateBooking({ ...valid(), date: '2099-01-03T02:00:00-08:00' }));
  assert.throws(() => validateBooking({ ...valid(), duration: 8 }));
});
test('overlapping sessions share unique lock keys; adjacent sessions do not', () => {
  const a = lockKeys(new Date('2099-01-03T17:00:00Z'), new Date('2099-01-03T19:00:00Z'));
  const b = lockKeys(new Date('2099-01-03T18:00:00Z'), new Date('2099-01-03T20:00:00Z'));
  const c = lockKeys(new Date('2099-01-03T19:00:00Z'), new Date('2099-01-03T21:00:00Z'));
  assert.ok(a.some(k => b.includes(k)));
  assert.ok(!a.some(k => c.includes(k)));
});
test('payment association rejects mismatched amounts, currencies and capture modes', () => {
  const request = { _id: 'r', paymentIntentId: 'pi', amountCents: 45000 };
  const intent = { id: 'pi', metadata: { bookingRequestId: 'r' }, amount: 45000, currency: 'usd', capture_method: 'manual' };
  verifyIntent(request, intent);
  for (const mutation of [{ amount: 1 }, { currency: 'eur' }, { capture_method: 'automatic' }, { metadata: {} }]) assert.throws(() => verifyIntent(request, { ...intent, ...mutation }));
});
test('decision deadline precedes actual authorization expiry', () => {
  const now = 2000000000000;
  assert.equal(+decisionDeadline({ latest_charge: { payment_method_details: { card: { capture_before: (now + 7200000)/1000 } } } }, now), now + 3600000);
});
// Exercise the durable processor with fake providers: no real charge, email or database.
const requests = new Map(), locks = new Map(), intents = new Map(), events = new Map();
let captures = 0, cancels = 0, refunds = 0, notices = [], failCapture = false;
function mock(path, exports) { require.cache[require.resolve(path)] = { id: require.resolve(path), filename: require.resolve(path), loaded: true, exports }; }
mock('../models/BookingRequest', {
  findOneAndUpdate: async ({ _id }) => { const r = requests.get(_id); if (!r || r.leaseUntil > new Date()) return null; r.leaseUntil = new Date(Date.now()+300000); return r; },
  updateOne: async ({ _id }) => { delete requests.get(_id).leaseUntil; },
});
mock('../models/BookingSlotLock', { create: async d => { if (locks.has(d._id)) { const e = new Error(); e.code = 11000; throw e; } locks.set(d._id,d); }, findById: async id => locks.get(id), deleteMany: async ({requestId}) => { for (const [k,v] of locks) if(v.requestId === requestId) locks.delete(k); } });
mock('../models/Event', { exists: async () => false, updateOne: async ({_id}, data) => events.set(_id,data) });
mock('../models/User', { findOneAndUpdate: async () => ({ _id: 'u' }) });
mock('../models/Reservation', { updateOne: async () => {} });
mock('../models/Payment', { updateOne: async () => {} });
mock('../models/CalendarConnection', { findById: async () => ({calendarId:'cal'}) });
mock('../utils/stripe', { stripe: { paymentIntents: {
  retrieve: async id => intents.get(id),
  capture: async id => { if(failCapture) throw new Error('network'); captures++; intents.get(id).status='succeeded'; },
  cancel: async id => { cancels++; intents.get(id).status='canceled'; },
}, refunds: { create: async () => {refunds++;} } } });
mock('../utils/googleCalendar', { ensureBookingEvent: async r => {r.googleEventId='google';}, removeBookingEvent: async () => {} });
mock('../utils/bookingRequestEmail', { notify: async r => notices.push(r.status) });
const { processRequest, acquire } = require('../utils/bookingRequests');
function setup(id, status='checkout', payment='requires_capture') {
  const r = { _id:id, status, customer:{email:'a@example.com',name:'Test'}, start:new Date('2099-01-03T17:00Z'), end:new Date('2099-01-03T19:00Z'), deadline:new Date(Date.now()+3600000), amountCents:45000, paymentIntentId:id, duration:2, tentCount:1, location:{}, save:async()=>{} };
  requests.set(id,r); intents.set(id,{id, amount:45000,currency:'usd',capture_method:'manual',metadata:{bookingRequestId:id},status:payment}); return r;
}
test('authorization becomes pending without capture; approval creates confirmed booking once', async () => {
  const r=setup('approve'); await processRequest(r._id);
  assert.equal(r.status,'pending'); assert.equal(captures,0); assert.ok(notices.includes('pending'));
  r.status='approving'; await processRequest(r._id);
  assert.equal(r.status,'confirmed'); assert.equal(captures,1); assert.ok(events.has(r._id));
  await processRequest(r._id); assert.equal(captures,1);
});
test('denial releases hold and slot; captured recovery refunds fully', async () => {
  const r=setup('deny','denying'); await acquire(r); await processRequest(r._id);
  assert.equal(r.status,'denied'); assert.equal(cancels,1); assert.ok(![...locks.values()].some(l=>l.requestId===r._id));
  const paid=setup('paid','denying','succeeded'); await processRequest(paid._id);
  assert.equal(paid.status,'denied'); assert.equal(refunds,1);
});
test('expired request releases authorization and slot', async () => {
  const r=setup('expire','pending'); r.deadline=new Date(0); await acquire(r); await processRequest(r._id);
  assert.equal(r.status,'expired'); assert.ok(![...locks.values()].some(l=>l.requestId===r._id));
});
test('capture failures remain recoverable; retry finishes without duplicate booking', async () => {
  const r=setup('retry','approving'); failCapture=true; await processRequest(r._id);
  assert.equal(r.status,'approving'); assert.ok(r.lastError); failCapture=false;
  await processRequest(r._id); assert.equal(r.status,'confirmed'); assert.ok(events.has(r._id));
});

test('simultaneous overlapping requests cannot own the same slot', async () => {
  const first=setup('lock-first'); const second=setup('lock-second');
  await acquire(first);
  await assert.rejects(acquire(second));
  assert.ok([...locks.values()].some(l=>l.requestId===first._id));
  assert.ok(![...locks.values()].some(l=>l.requestId===second._id));
});

test('automatic approval is restricted to explicitly enabled non-production test-card payments', () => {
  const { shouldAutoApproveTest } = require('../utils/bookingRules');
  const intent = { livemode: false, status: 'requires_capture', latest_charge: { payment_method_details: { card: { brand: 'visa', last4: '4242' } } } };
  const env = { STRIPE_AUTO_APPROVE_TEST_BOOKINGS: 'true', NODE_ENV: 'development' };
  assert.equal(shouldAutoApproveTest(intent, env), true);
  assert.equal(shouldAutoApproveTest({...intent, livemode:true}, env), false);
  assert.equal(shouldAutoApproveTest(intent, {...env, NODE_ENV:'production'}), false);
  assert.equal(shouldAutoApproveTest(intent, {...env, STRIPE_AUTO_APPROVE_TEST_BOOKINGS:'false'}), false);
  assert.equal(shouldAutoApproveTest({...intent, latest_charge: null}, env), false);
  assert.equal(shouldAutoApproveTest({...intent, status:'requires_payment_method'}, env), false);
});
test('only new opted-in test requests auto-approve through the normal calendar and capture flow', async () => {
  const saved = process.env.STRIPE_AUTO_APPROVE_TEST_BOOKINGS;
  const mode = process.env.NODE_ENV;
  process.env.STRIPE_AUTO_APPROVE_TEST_BOOKINGS='true'; process.env.NODE_ENV='development';
  try {
    locks.clear();
    const r=setup('auto'); r.autoApproveTest=true;
    Object.assign(intents.get('auto'), {livemode:false,latest_charge:{payment_method_details:{card:{brand:'visa',last4:'4242'}}}});
    await processRequest(r._id);
    assert.equal(r.status,'confirmed'); assert.equal(r.autoApproved,true); assert.ok(events.has(r._id));
    const manual=setup('manual'); Object.assign(intents.get('manual'), {livemode:false,latest_charge:{payment_method_details:{card:{brand:'visa',last4:'4242'}}}});
    await processRequest(manual._id); assert.equal(manual.status,'pending');
  } finally {
    if(saved === undefined) delete process.env.STRIPE_AUTO_APPROVE_TEST_BOOKINGS; else process.env.STRIPE_AUTO_APPROVE_TEST_BOOKINGS=saved;
    if(mode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV=mode;
  }
});
