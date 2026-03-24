const publicRouter = require("express").Router();
const adminRouter = require("express").Router();
const Reservation = require("../models/Reservation");
const Event = require("../models/Event");
const User = require("../models/User");
const Payment = require("../models/Payment");
const { sendBookingConfirmation } = require("../utils/email");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// PUBLIC: Create reservation (called after payment or credit use)
publicRouter.post("/", async (req, res) => {
  try {
    const { eventId, userId, stripePaymentId, usedCredit } = req.body;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (event.booked)
      return res.status(400).json({ error: "Event is already booked" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Check existing reservation
    const existing = await Reservation.findOne({
      event: eventId,
      user: userId,
      cancelled: false,
    });
    if (existing) return res.status(400).json({ error: "Already reserved" });

    // Handle credit usage
    if (usedCredit) {
      if (user.credits <= 0)
        return res.status(400).json({ error: "No credits available" });
      user.credits -= 1;
      await user.save();
    }

    // Create reservation
    const reservation = new Reservation({
      event: eventId,
      user: userId,
    });
    await reservation.save();

    // Create payment record
    const payment = new Payment({
      amount: usedCredit ? 0 : event.price,
      stripe_payment_id: usedCredit ? "credit_used" : stripePaymentId,
      reservation: reservation._id,
    });
    await payment.save();

    // Mark as booked: private events after first reservation, public events at full capacity
    if (event.type === "private") {
      event.booked = true;
      await event.save();
    } else {
      const reservationCount = await Reservation.countDocuments({
        event: eventId,
        cancelled: false,
      });
      if (reservationCount >= event.max_capacity) {
        event.booked = true;
        await event.save();
      }
    }

    // Send confirmation email
    await sendBookingConfirmation(user, event, reservation);

    const populated = await Reservation.findById(reservation._id)
      .populate("event")
      .populate("user");

    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUBLIC: Cancel reservation (from email link)
publicRouter.post("/:id/cancel", async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate("event")
      .populate("user");
    if (!reservation)
      return res.status(404).json({ error: "Reservation not found" });
    if (reservation.cancelled)
      return res.status(400).json({ error: "Already cancelled" });

    reservation.cancelled = true;
    await reservation.save();

    const payment = await Payment.findOne({ reservation: reservation._id });
    const event = reservation.event;
    const user = reservation.user;

    if (
      event.type === "private" &&
      payment &&
      payment.stripe_payment_id !== "credit_used"
    ) {
      // 75% refund for private events
      const refundAmount = Math.round(payment.amount * 0.75 * 100); // cents
      if (refundAmount > 0) {
        await stripe.refunds.create({
          payment_intent: payment.stripe_payment_id,
          amount: refundAmount,
        });
      }
    } else if (event.type === "public") {
      // Credit for public events
      user.credits += 1;
      await user.save();
    }

    // Update booked status: private events unbook on any cancellation, public events unbook when below capacity
    if (event.type === "private") {
      event.booked = false;
    } else {
      const remaining = await Reservation.countDocuments({
        event: event._id,
        cancelled: false,
      });
      event.booked = remaining >= event.max_capacity;
    }
    await event.save();

    res.json({ message: "Reservation cancelled", reservation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUBLIC: Get single reservation (needed for cancel page)
publicRouter.get("/:id", async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate("event")
      .populate("user");
    if (!reservation)
      return res.status(404).json({ error: "Reservation not found" });
    const payment = await Payment.findOne({ reservation: reservation._id });
    res.json({ ...reservation.toObject(), payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: Get all reservations
adminRouter.get("/", async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .populate("event")
      .populate("user")
      .sort({ date_created: -1 });
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { publicRouter, adminRouter };
