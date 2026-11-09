const { Resend } = require('resend');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function notify(request) {
  const stage = request.status;
  if (!['pending','confirmed','denied','expired'].includes(stage)) return;
  const client = new Resend(process.env.RESEND_API_KEY);
  const date = new Date(request.start).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const review = `${process.env.APP_URL || 'http://localhost:3000'}${process.env.ADMIN_PATH || '/admin-secret-dashboard-254'}?request=${encodeURIComponent(request._id)}`;
  const details = `<p>${escape(date)} (San Francisco time), ${escape(request.duration)} hours</p><p>${escape(request.location.name)} — ${escape(request.location.address)}</p><p>${escape(request.customer.name)} | ${escape(request.customer.email)} | ${escape(request.customer.phone)}</p><p>$${(request.amountCents / 100).toFixed(2)}</p>`;
  if (stage === 'pending') {
    const result = await client.emails.send({ from: 'Sauna Man SF <support@saunaman-sf.com>', to: ['support@saunaman-sf.com'], subject: `Booking request — ${date}`, html: `${details}<p>Respond by ${escape(request.deadline.toLocaleString('en-US', {timeZone:'America/Los_Angeles'}))} San Francisco time.</p><a href="${escape(review)}">Review request: approve or deny</a>` }, { idempotencyKey: `${request._id}-admin-pending` });
    if (result.error) throw new Error('Admin email delivery failed');
  }
  const message = stage === 'pending' ? 'Your timeslot and booking is under review we will get back to you shortly' : stage === 'confirmed' ? 'Your booking is confirmed and payment has been collected.' : `Your booking request was ${stage}. Your payment authorization has been released, or any captured payment has been fully refunded. Your bank may take time to reflect this.`;
  const result = await client.emails.send({ from: 'Sauna Man SF <support@saunaman-sf.com>', to: [request.customer.email], subject: `Saunaman booking: ${stage}`, html: `<p>${escape(message)}</p>${details}${stage === 'confirmed' ? `<p><a href="${escape(`${process.env.APP_URL || 'http://localhost:3000'}/cancel/${request._id}`)}">View cancellation options</a></p>` : ''}` }, { idempotencyKey: `${request._id}-customer-${stage}` });
  if (result.error) throw new Error('Customer email delivery failed');
}
module.exports = { notify };
