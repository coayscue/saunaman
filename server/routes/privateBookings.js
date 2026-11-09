const { DateTime } = require("luxon");
const { busy: googleBusy } = require("../utils/googleCalendar");
const router = require("express").Router();
const Event = require("../models/Event");
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

    const day = DateTime.fromISO(date, { zone: "America/Los_Angeles" }).startOf("day");
    if (!day.isValid) return res.status(400).json({ error: "Invalid date" });
    const dayStart = day.toJSDate();
    const dayEnd = day.endOf("day").toJSDate();

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

    const from = new Date(start), to = new Date(end);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to - from > 45 * 86400000) return res.status(400).json({ error: "Invalid availability range" });
    const [external, events] = await Promise.all([
      googleBusy(from, to),
      Event.find({ type: "private", booked: true, date: { $lt: to }, $expr: { $gt: [{ $add: ["$date", { $multiply: [{ $ifNull: ["$duration", 120] }, 60000] }] }, from] } }).select("date duration location"),
    ]);
    res.set("Cache-Control", "no-store");
    const locks = await require('../models/BookingSlotLock').find({ date: { $gte: from, $lt: to } });
    res.json([...events.map(e => e.toObject()), ...external, ...locks.map(lock => ({ date: lock.date, duration: 60 }))]);
  } catch {
    res.status(503).json({ error: "Availability temporarily unavailable. Please try again." });
  }
});

// Old clients must refresh instead of bypassing request approval.
router.post('/create-intent', (req, res) => res.status(410).json({ error: 'Refresh the page to use booking requests' }));
router.post('/book', (req, res) => res.status(410).json({ error: 'Refresh the page to use booking requests' }));
module.exports = router;
module.exports.LOCATIONS = LOCATIONS;
