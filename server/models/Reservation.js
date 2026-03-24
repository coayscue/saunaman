const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const reservationSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  event: { type: String, ref: 'Event', required: true },
  user: { type: String, ref: 'User', required: true },
  date_created: { type: Date, default: Date.now },
  cancelled: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Reservation', reservationSchema);
