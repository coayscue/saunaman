const router = require("express").Router();
const Event = require("../models/Event");
const User = require("../models/User");
const Reservation = require("../models/Reservation");
const Payment = require("../models/Payment");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const {
  sendPrivateBookingNotification,
  sendPrivateBookingReceipt,
} = require("../utils/email");

// Locations list (5 SF locations near water)
const LOCATIONS = [
  {
    id: "baker-beach",
    name: "Baker Beach",
    address: "Baker Beach, San Francisco, CA 94129",
    lat: 37.7936,
    lng: -122.4835,
  },
  {
    id: "ocean-beach",
    name: "Ocean Beach",
    address: "Ocean Beach, San Francisco, CA 94122",
    lat: 37.776163,
    lng: -122.511923,
  },
  {
    id: "aquatic-park",
    name: "Aquatic Park",
    address: "Aquatic Park, San Francisco, CA 94109",
    lat: 37.807,
    lng: -122.422,
  },
  {
    id: "crissy-field",
    name: "Crissy Field",
    address: "Crissy Field, San Francisco, CA 94129",
    lat: 37.806639,
    lng: -122.448406,
  },
  {
    id: "china-beach",
    name: "China Beach",
    address: "China Beach, San Francisco, CA 94121",
    lat: 37.7878,
    lng: -122.491,
  },
];

// GET locations
router.get("/locations", (req, res) => {
  res.json(LOCATIONS);
});

// GET available locations for a specific date
// If any private event exists on that date, only return that location
router.get("/available-locations", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Date is required" });

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const existingEvents = await Event.find({
      type: "private",
      date: { $gte: dayStart, $lte: dayEnd },
      booked: true,
    });

    if (
      existingEvents.length > 0 &&
      existingEvents[0].location &&
      existingEvents[0].location.name
    ) {
      // Only show the location that's already booked for this day
      const lockedLocation = LOCATIONS.find(
        (l) => l.name === existingEvents[0].location.name,
      );
      res.json(lockedLocation ? [lockedLocation] : LOCATIONS);
    } else {
      res.json(LOCATIONS);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET booked time slots for a date range
router.get("/booked-slots", async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end)
      return res.status(400).json({ error: "Start and end dates required" });

    const events = await Event.find({
      type: "private",
      date: { $gte: new Date(start), $lte: new Date(end) },
      booked: true,
    }).select("date duration location");

    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function calcPrice(tentCount, duration) {
  const base = tentCount === 2 ? 700 : 450;
  if (duration === 4) return base * 2;
  if (duration === 3) return Math.round(base * 1.5);
  return base;
}

// POST create payment intent for private booking
router.post("/create-intent", async (req, res) => {
  try {
    const { tentCount, duration = 2 } = req.body;
    const price = calcPrice(tentCount, duration);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100),
      currency: "usd",
      payment_method_types: ["apple_pay", "card"],
    });
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      price,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST complete private booking (after payment)
router.post("/book", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      tentCount,
      duration = 2,
      locationId,
      customLocation,
      customLocationName,
      date,
      stripePaymentId,
    } = req.body;

    // Resolve location from preset or custom text
    let location;
    if (locationId) {
      location = LOCATIONS.find((l) => l.id === locationId);
      if (!location) return res.status(400).json({ error: "Invalid location" });
    } else if (customLocation) {
      location = {
        name: customLocationName || customLocation,
        address: customLocation,
        lat: null,
        lng: null,
      };
    } else {
      return res.status(400).json({ error: "A location is required" });
    }

    const price = calcPrice(tentCount, duration);
    const capacity = tentCount === 2 ? 24 : 12;
    const durationMinutes = duration * 60;
    const eventDate = new Date(date);

    // Enforce 36-hour advance booking
    const minAdvanceMs = 36 * 60 * 60 * 1000;
    if (eventDate.getTime() - Date.now() < minAdvanceMs) {
      return res
        .status(400)
        .json({ error: "Bookings must be made at least 36 hours in advance" });
    }

    // Check for overlapping events
    const slotStart = new Date(eventDate);
    const slotEnd = new Date(eventDate.getTime() + durationMinutes * 60 * 1000);
    const overlapping = await Event.findOne({
      type: "private",
      booked: true,
      date: { $gte: slotStart, $lt: slotEnd },
    });
    if (overlapping)
      return res
        .status(400)
        .json({ error: "This time slot is already booked" });

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name, phone, signedWaiver: true });
      await user.save();
    } else {
      if (name) user.name = name;
      if (phone) user.phone = phone;
      user.signedWaiver = true;
      await user.save();
    }

    // Create the private event
    const event = new Event({
      name: `Private Sauna - ${name}`,
      date: eventDate,
      duration: durationMinutes,
      price,
      max_capacity: capacity,
      type: "private",
      booked: true,
      tent_count: tentCount,
      location: {
        name: location.name,
        address: location.address,
        lat: location.lat,
        lng: location.lng,
      },
    });
    await event.save();

    // Create reservation
    const reservation = new Reservation({
      event: event._id,
      user: user._id,
    });
    await reservation.save();

    // Create payment record
    const payment = new Payment({
      amount: price,
      stripe_payment_id: stripePaymentId,
      reservation: reservation._id,
    });
    await payment.save();

    // Send notification to admins
    await sendPrivateBookingNotification(user, event, location);

    // Send receipt to customer
    await sendPrivateBookingReceipt(user, event, reservation, location, price);

    res.status(201).json({ event, reservation, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
