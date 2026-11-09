const router = require('express').Router();
const Request = require('../models/BookingRequest');
const Lock = require('../models/BookingSlotLock');
const { stripe } = require('../utils/stripe');
const { validateBooking } = require('../utils/bookingRules');
const service = require('../utils/bookingRequests');
module.exports = requireAdmin => {
  router.post('/', async (req, res) => {
    let request;
    try {
      const details = validateBooking(req.body);
      const { LOCATIONS } = require('./privateBookings');
      const location = req.body.locationId ? LOCATIONS.find(l => l.id === req.body.locationId) : { name: req.body.customLocationName || req.body.customLocation, address: req.body.customLocation };
      if (!location?.name || !location?.address || location.name.length > 300 || location.address.length > 500) return res.status(400).json({ error: 'Valid location required' });
      request = await Request.create({ ...details, autoApproveTest: process.env.STRIPE_AUTO_APPROVE_TEST_BOOKINGS === 'true' && process.env.NODE_ENV !== 'production', customer: { name: req.body.name.trim(), email: req.body.email.trim().toLowerCase(), phone: req.body.phone.trim() }, location, duration: req.body.duration, tentCount: req.body.tentCount, deadline: new Date(Date.now()+15*60000) });
      await service.acquire(request);
      if (await service.localConflict(request) || (await require('../utils/googleCalendar').busy(request.start, request.end)).length) throw new Error('This time is unavailable');
      const intent = await service.intentFor(request);
      res.status(201).json({ requestId: request._id, clientSecret: intent.client_secret });
    } catch (e) {
      if (request) {
        request.status = 'expiring'; await request.save();
        // Worker reconciles any possibly-created intent before releasing locks.
      }
      res.status(400).json({ error: 'Unable to request this time. Check details and availability, then try again.' });
    }
  });
  router.post('/:id/submitted', async (req, res) => {
    try {
      const request = await Request.findOne({ _id: req.params.id, paymentIntentId: req.body.paymentIntentId });
      if (!request) return res.status(404).json({ error: 'Request not found' });
      await service.processRequest(request._id);
      const updated = await Request.findById(request._id);
      if (updated.status === 'checkout') {
        // Another worker may hold the lease; verify authorization without overwriting its state.
        const intent = await service.intentFor(updated);
        if (intent.status === 'requires_capture') return res.status(202).json({ status: 'pending' });
      }
      if (!['pending','approving','confirmed'].includes(updated.status)) return res.status(409).json({ error: 'Payment authorization is incomplete or the request has expired. Check status before retrying.' });
      res.json({ status: updated.status });
    } catch { res.status(503).json({ error: 'Unable to verify authorization. Your request will be reconciled automatically.' }); }
  });
  router.get('/', requireAdmin, async (req, res) => {
    try {
      const requests = await Request.find().sort({ createdAt: -1 }).limit(200).lean();
      const events = await require('../models/Event').find({ _id: { $in: requests.map(r => r._id) } }).select('cancellationState deletedAt date duration location').lean();
      const byId = new Map(events.map(e => [e._id, e]));
      res.json(requests.map(request => ({ ...request, ...(byId.get(request._id) ? {start:byId.get(request._id).date, duration:byId.get(request._id).duration / 60, location:byId.get(request._id).location || {name:'',address:''}} : {}), eventCancellationState: byId.get(request._id)?.cancellationState, eventDeleted: !!byId.get(request._id)?.deletedAt })));
    }
    catch { res.status(503).json({ error: 'Unable to load requests' }); }
  });
  router.post('/:id/:decision', requireAdmin, async (req, res) => {
    const target = { approve: 'approving', deny: 'denying' }[req.params.decision];
    if (!target) return res.status(400).json({ error: 'Unknown decision' });
    try {
      const request = await Request.findOneAndUpdate({ _id: req.params.id, status: 'pending', deadline: { $gt: new Date() }, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: null }, { leaseUntil: { $lt: new Date() } }] }, { $set: { status: target } }, { new: true });
      if (!request) return res.status(409).json({ error: 'Request expired, already decided, or processing. Refresh and try again.' });
      await service.processRequest(request._id);
      res.json(await Request.findById(request._id));
    } catch { res.status(503).json({ error: 'Decision processing will be retried. Refresh status before trying again.' }); }
  });
  return router;
};
module.exports.webhook = async (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Webhook not configured');
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return res.status(400).send('Invalid signature'); }
  try {
    const intent = event.data.object;
    if (event.type.startsWith('payment_intent.') && intent.metadata?.bookingRequestId) {
      const request = await Request.findOne({ _id: intent.metadata.bookingRequestId, paymentIntentId: intent.id });
      if (request) await service.processRequest(request._id);
    }
    res.json({ received: true });
  } catch { res.status(503).send('Retry webhook'); }
};
