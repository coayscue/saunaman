const publicRouter = require('express').Router();
const adminRouter = require('express').Router();
const User = require('../models/User');
const Reservation = require('../models/Reservation');
const Donation = require('../models/Donation');

// PUBLIC: Find or create user by email (used during booking)
publicRouter.post('/find-or-create', async (req, res) => {
  try {
    const { email, name } = req.body;
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name });
      await user.save();
    } else if (name && user.name !== name) {
      user.name = name;
      await user.save();
    }
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUBLIC: Sign waiver (find or create user, mark waiver signed)
publicRouter.post('/sign-waiver', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name, signedWaiver: true });
    } else {
      if (name) user.name = name;
      user.signedWaiver = true;
    }
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN: Get all users
adminRouter.get('/', async (req, res) => {
  try {
    const users = await User.find().sort({ name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: Get single user with reservations
adminRouter.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const reservations = await Reservation.find({ user: user._id }).populate('event');
    const donations = await Donation.find({ user: user._id }).sort({ date: -1 });
    res.json({ ...user.toObject(), reservations, donations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { publicRouter, adminRouter };
