const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const SENDER = process.env.SENDER_EMAIL || "support@saunaman-sf.com";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

async function sendBookingConfirmation(user, event, reservation) {
  try {
    const cancelUrl = `${APP_URL}/cancel/${reservation._id}`;
    const eventDate = new Date(event.date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    await resend.emails.send({
      from: SENDER,
      to: user.email,
      subject: `Booking Confirmed - ${event.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #b45309;">🔥 Sauna Man - Booking Confirmed!</h1>
          <p>Hey ${user.name},</p>
          <p>Your reservation has been confirmed!</p>
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">${event.name}</h2>
            <p><strong>Date:</strong> ${eventDate}</p>
            <p><strong>Type:</strong> ${event.type === "public" ? "Public Session" : "Private Session"}</p>
          </div>
          <p style="margin-top: 40px;">Need to cancel? <a href="${cancelUrl}" style="color: #dc2626; text-decoration: none;">Cancel Reservation</a></p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Private event cancellations receive a 75% refund. Public event cancellations receive a credit for future use.
          </p>
        </div>
      `,
    });
    console.log(`Confirmation email sent to ${user.email}`);
  } catch (err) {
    console.error("Email send error:", err);
  }
}

module.exports = { sendBookingConfirmation };
