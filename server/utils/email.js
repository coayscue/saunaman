const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const SENDER = "Sauna Man SF <support@saunaman-sf.com>";
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

async function sendDonationConfirmation(email, name, amount) {
  try {
    const displayName = name || "Friend";
    await resend.emails.send({
      from: SENDER,
      to: email,
      subject: "Thank You for Your Donation!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #b45309;">🔥 Sauna Man - Thank You!</h1>
          <p>Hey ${displayName},</p>
          <p>Thank you so much for your generous donation!</p>
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Donation Received</h2>
            <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Your support helps us keep the sauna fires burning. We truly appreciate it!
          </p>
        </div>
      `,
    });
    console.log(`Donation confirmation email sent to ${email}`);
  } catch (err) {
    console.error("Email send error:", err);
  }
}

async function sendPrivateBookingNotification(user, event, location) {
  try {
    const eventDate = new Date(event.date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const adminUrl = `${APP_URL}${process.env.ADMIN_PATH || '/admin-secret-dashboard-254'}?event=${event._id}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #b45309;">🔥 New Private Booking!</h1>
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin-top: 0;">Booking Details</h2>
          <p><strong>Name:</strong> ${user.name}</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Phone:</strong> ${user.phone || "Not provided"}</p>
          <p><strong>Date:</strong> ${eventDate}</p>
          <p><strong>Duration:</strong> ${event.duration} minutes</p>
          <p><strong>Tents:</strong> ${event.tent_count} (${event.max_capacity} people capacity)</p>
          <p><strong>Location:</strong> ${location.name}</p>
          <p><strong>Address:</strong> ${location.address}</p>
          <p><strong>Price:</strong> $${event.price}</p>
        </div>
        <a href="${adminUrl}" style="display: inline-block; background: #b45309; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          View Booking in Admin Dashboard
        </a>
      </div>
    `;

    await resend.emails.send({
      from: SENDER,
      to: ["support@saunaman-sf.com", "ajensign@gmail.com"],
      subject: `New Private Booking - ${user.name} - ${eventDate}`,
      html,
    });
    console.log("Private booking notification sent to admins");
  } catch (err) {
    console.error("Admin notification email error:", err);
  }
}

async function sendPrivateBookingReceipt(user, event, reservation, location, price) {
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

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`;
    const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${location.lat},${location.lng}&zoom=15&size=600x300&maptype=roadmap&markers=color:red%7C${location.lat},${location.lng}&key=${process.env.GOOGLE_MAPS_API_KEY || ""}`;

    await resend.emails.send({
      from: SENDER,
      to: user.email,
      subject: `Receipt - Private Sauna Booking - ${eventDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #b45309;">🔥 Sauna Man - Booking Receipt</h1>
          <p>Hey ${user.name},</p>
          <p>Thank you for your booking! Here are your details:</p>

          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Private Sauna Session</h2>
            <p><strong>Date:</strong> ${eventDate}</p>
            <p><strong>Duration:</strong> 2 hours</p>
            <p><strong>Tents:</strong> ${event.tent_count} (up to ${event.max_capacity} people)</p>
            <p><strong>Amount Paid:</strong> $${price.toFixed(2)}</p>
          </div>

          <div style="margin: 20px 0;">
            <h3>What's Included:</h3>
            <ul>
              <li>2 hour event</li>
              <li>Sauna tent set up near the water</li>
              <li>Cold plunge</li>
              <li>Changing tent</li>
            </ul>
          </div>

          <div style="margin: 20px 0;">
            <h3>Location: ${location.name}</h3>
            <p>${location.address}</p>
            ${process.env.GOOGLE_MAPS_API_KEY ? `<img src="${staticMapUrl}" alt="Map of ${location.name}" style="width: 100%; border-radius: 8px; margin: 10px 0;" />` : ""}
            <a href="${mapsUrl}" style="display: inline-block; background: #4285F4; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 10px;">
              📍 Open in Google Maps
            </a>
          </div>

          <p style="margin-top: 40px;">Need to cancel? <a href="${cancelUrl}" style="color: #dc2626; text-decoration: none;">Cancel Reservation</a></p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Private event cancellations receive a 75% refund.
          </p>
        </div>
      `,
    });
    console.log(`Private booking receipt sent to ${user.email}`);
  } catch (err) {
    console.error("Receipt email error:", err);
  }
}

async function sendReviewRequest(user, event, reservation) {
  try {
    const reviewUrl = `${APP_URL}/review/${reservation._id}`;
    const eventDate = new Date(event.date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    await resend.emails.send({
      from: SENDER,
      to: user.email,
      subject: `How was your Sauna Man experience? - ${eventDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #b45309;">🔥 Sauna Man - We'd Love Your Feedback!</h1>
          <p>Hey ${user.name},</p>
          <p>We hope you had an amazing time at your recent sauna session!</p>

          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">${event.name}</h2>
            <p><strong>Date:</strong> ${eventDate}</p>
          </div>

          <p>Would you mind taking a moment to share your experience? Your review helps others discover Sauna Man and helps us improve!</p>
          <p>You can also upload photos from your session.</p>

          <a href="${reviewUrl}" style="display: inline-block; background: #FF4F00; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 1.1rem; margin: 20px 0;">
            Leave a Review
          </a>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Thank you for choosing Sauna Man!
          </p>
        </div>
      `,
    });
    console.log(`Review request email sent to ${user.email}`);
  } catch (err) {
    console.error("Review request email error:", err);
  }
}

module.exports = { sendBookingConfirmation, sendDonationConfirmation, sendPrivateBookingNotification, sendPrivateBookingReceipt, sendReviewRequest };
