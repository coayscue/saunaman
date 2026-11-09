const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
module.exports = mongoose.model('BookingRequest', new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  customer: { name: String, email: String, phone: String },
  start: Date, end: Date, duration: Number, tentCount: Number,
  location: { name: String, address: String },
  amountCents: Number,
  status: { type: String, enum: ['checkout', 'pending', 'approving', 'denying', 'expiring', 'confirmed', 'denied', 'expired'], default: 'checkout', index: true },
  paymentIntentId: String, paymentStatus: String,
  deadline: Date, leaseUntil: Date, leaseOwner: String, lastError: String,
  googleEventId: String, calendarId: String,
  autoApproveTest: { type: Boolean, default: false },
  autoApproved: { type: Boolean, default: false },
  noticeStatus: String, noticeDecision: String,
}, { timestamps: true }));
