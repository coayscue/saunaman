const publicRouter = require('express').Router();
const adminRouter = require('express').Router();
const Event = require('../models/Event');
const Reservation = require('../models/Reservation');
const User = require('../models/User');

// PUBLIC: Get all events
publicRouter.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    const events = await Event.find(filter).sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUBLIC: Get single event
publicRouter.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUBLIC: Get registered guest names for an event
publicRouter.get('/:id/guests', async (req, res) => {
  try {
    const reservations = await Reservation.find({ event: req.params.id, cancelled: false }).populate('user', 'name');
    const guests = reservations.map((r) => r.user?.name).filter(Boolean);
    res.json(guests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: Create event
adminRouter.post('/', async (req, res) => {
  try {
    const event = new Event(req.body);
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN: Update event
adminRouter.put('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN: Delete event
adminRouter.delete('/:id', async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { publicRouter, adminRouter };
