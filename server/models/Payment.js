const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const paymentSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  stripe_payment_id: { type: String, required: true },
  reservation: { type: String, ref: 'Reservation', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
