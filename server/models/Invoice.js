const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const invoiceSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  paid: { type: Boolean, default: false },
  cancelled: { type: Boolean, default: false },
  date_paid: { type: Date },
  date_created: { type: Date, default: Date.now },
  amount: { type: Number, required: true },
  description: { type: String, default: '' },
  stripe_payment_id: { type: String },
  user: { type: String, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
