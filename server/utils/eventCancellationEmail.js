const { Resend } = require('resend');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function send(event, reservation, credit) {
  if (!reservation.user?.email) throw new Error('Customer email missing');
  const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: 'Sauna Man SF <support@saunaman-sf.com>', to: [reservation.user.email],
    subject: `Saunaman event cancelled — ${event.name}`,
    html: `<p>Your event has been cancelled by Saunaman.</p><p>${escape(event.name)} — ${escape(new Date(event.date).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))} San Francisco time</p><p>${credit ? 'Your booking credit has been restored.' : 'Any payment collected for this reservation has been fully refunded. An uncaptured authorization has been released. Your bank may take time to reflect this.'}</p>`,
  }, { idempotencyKey: `event-cancel-${event._id}-${reservation._id}` });
  if (result.error) throw new Error('Customer cancellation email failed');
}
module.exports = { send };
