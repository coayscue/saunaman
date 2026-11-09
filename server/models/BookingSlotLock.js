const mongoose = require('mongoose');
// Deliberately no TTL: a worker releases locks only after payment is reconciled.
module.exports = mongoose.model('BookingSlotLock', new mongoose.Schema({
  _id: String, requestId: { type: String, index: true }, date: Date,
}));
