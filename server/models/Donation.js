const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const donationSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  user: { type: String, ref: 'User', required: true },
  stripe_payment_id: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Donation', donationSchema);
