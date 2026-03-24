const publicRouter = require('express').Router();
const adminRouter = require('express').Router();
const Donation = require('../models/Donation');
const User = require('../models/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { sendDonationConfirmation } = require('../utils/email');

// PUBLIC: Create payment intent for donation
publicRouter.post('/create-intent', async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount < 1) return res.status(400).json({ error: 'Minimum donation is $1' });
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      automatic_payment_methods: { enabled: true }
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUBLIC: Record donation after payment
publicRouter.post('/', async (req, res) => {
  try {
    const { amount, email, name, stripePaymentId } = req.body;

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name: name || '' });
      await user.save();
    } else if (name && user.name !== name) {
      user.name = name;
      await user.save();
    }

    const donation = new Donation({
      amount,
      user: user._id,
      stripe_payment_id: stripePaymentId
    });
    await donation.save();
    await sendDonationConfirmation(email, name, amount);
    res.status(201).json(donation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN: Get all donations
adminRouter.get('/', async (req, res) => {
  try {
    const donations = await Donation.find().populate('user').sort({ date: -1 });
    res.json(donations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { publicRouter, adminRouter };
