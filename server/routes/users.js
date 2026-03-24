const publicRouter = require('express').Router();
const adminRouter = require('express').Router();
const User = require('../models/User');
const Reservation = require('../models/Reservation');

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
    res.json({ ...user.toObject(), reservations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { publicRouter, adminRouter };
