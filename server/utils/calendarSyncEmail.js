const { Resend } = require('resend');
const Reservation = require('../models/Reservation');
const escape = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function sendNotices(event) {
  const shape = JSON.parse(event.syncNoticePayload);
  const reservations = await Reservation.find({ event: event._id, cancelled: false }).populate('user');
  const client = new Resend(process.env.RESEND_API_KEY);
  for (const reservation of reservations) {
    if (!reservation.user?.email) throw new Error('Customer email unavailable');
    const result = await client.emails.send({ from: 'Sauna Man SF <support@saunaman-sf.com>', to: [reservation.user.email], subject: 'Your Saunaman booking details have changed', html: `<p>Your booking schedule or location has changed.</p><p>${escape(new Date(shape.start).toLocaleString('en-US', {timeZone:'America/Los_Angeles'}))} – ${escape(new Date(shape.end).toLocaleString('en-US', {timeZone:'America/Los_Angeles'}))} San Francisco time</p><p>${escape(shape.location)}</p><p>Contact support@saunaman-sf.com if this change does not work for you. Your payment amount has not changed.</p>` }, { idempotencyKey: `sync-${event._id}-${event.syncNoticeKey}-${reservation._id}` });
    if (result.error) throw new Error('Change notification delivery failed');
  }
}
module.exports = { sendNotices };
