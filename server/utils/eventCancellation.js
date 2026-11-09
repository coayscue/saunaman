const crypto = require('crypto');
function createService({ Event, Reservation, User, Payment, Request, stripe, calendar, send }) {
  async function process(id) {
    const owner = crypto.randomUUID();
    const event = await Event.findOneAndUpdate({ _id: id, cancellationState: { $in: ['cancelling','cancelled'] }, $or: [{ cancellationLease: null }, { cancellationLease: { $exists: false } }, { cancellationLease: { $lt: new Date() } }] }, { $set: { cancellationLease: new Date(Date.now()+300000), cancellationOwner: owner } }, { new: true });
    if (!event) return;
    try {
      const reservations = await Reservation.find({ event: id }).populate('user');
      if (event.cancellationState === 'cancelling') {
        for (const reservation of reservations) {
          const payment = await Payment.findOne({ reservation: reservation._id });
          if (payment?.stripe_payment_id === 'credit_used') {
            if (!reservation.cancelled) await User.updateOne({ _id: reservation.user._id, cancellationCredits: { $ne: reservation._id } }, { $inc: { credits: 1 }, $addToSet: { cancellationCredits: reservation._id } });
          } else if (payment) {
            const intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_id, { expand: ['latest_charge'] });
            if (intent.status === 'succeeded') {
              const charge = intent.latest_charge;
              if (!charge || typeof charge !== 'object') throw new Error('Cannot verify captured charge');
              if (charge.amount_refunded < charge.amount) {
                const refund = await stripe.refunds.create({ payment_intent: intent.id }, { idempotencyKey: `admin-event-cancel-${id}-${reservation._id}` });
                if (['failed','canceled'].includes(refund.status)) throw new Error('Refund failed');
              }
            } else if (intent.status !== 'canceled') {
              await stripe.paymentIntents.cancel(intent.id, {}, { idempotencyKey: `admin-event-cancel-${id}-${reservation._id}` });
            }
          } else if (!reservation.cancelled && event.price > 0) throw new Error('Payment record missing; cancellation requires review');
        }
        const request = await Request.findById(id);
        if (request?.googleEventId) await calendar.removeBookingEvent(request);
        else if (event.googleEventId) await calendar.removeBookingEvent({ _id:event._id, calendarId:event.googleCalendarId });
        await Reservation.updateMany({ event: id }, { $set: { cancelled: true } });
        // The request remains confirmed for audit history; the cancellation is on Event.
        event.cancellationState = 'cancelled'; event.booked = false;
        if (event.deleteRequested) event.deletedAt = new Date();
        event.cancellationError = ''; await event.save();
      }
      for (const reservation of reservations) {
        if (reservation.eventCancellationNotified) continue;
        const payment = await Payment.findOne({ reservation: reservation._id });
        await send(event, reservation, payment?.stripe_payment_id === 'credit_used');
        await Reservation.updateOne({ _id: reservation._id }, { $set: { eventCancellationNotified: true } });
      }
      event.cancellationError = ''; event.cancellationNotificationsComplete = true; await event.save();
    } catch {
      event.cancellationError = 'Cancellation processing needs retry. Check refunds, Google access and email delivery. Completed refunds will not be repeated.';
      await event.save();
    } finally {
      await Event.updateOne({ _id: id, cancellationOwner: owner }, { $unset: { cancellationLease: 1, cancellationOwner: 1 } });
    }
  }
  async function request(id, remove = false) {
    const event = await Event.findById(id);
    if (!event) return null;
    if (remove) event.deleteRequested = true;
    if (event.cancellationState !== 'cancelled') event.cancellationState = 'cancelling';
    else if (remove) event.deletedAt = new Date();
    await event.save();
    await process(id);
    return Event.findById(id);
  }
  let running = false;
  async function tick() {
    if (running) return; running = true;
    try {
      const events = await Event.find({ $or: [{ cancellationState: 'cancelling' }, { cancellationState: 'cancelled', cancellationNotificationsComplete: { $ne: true } }] }).sort({ updatedAt: 1 }).limit(100);
      for (const event of events) await process(event._id);
    } catch { console.error('Event cancellation worker will retry'); }
    finally { running = false; }
  }
  return { request, process, tick };
}
module.exports.createService = createService;
module.exports.service = () => createService({ Event: require('../models/Event'), Reservation: require('../models/Reservation'), User: require('../models/User'), Payment: require('../models/Payment'), Request: require('../models/BookingRequest'), stripe: require('./stripe').stripe, calendar: require('./googleCalendar'), send: require('./eventCancellationEmail').send });
