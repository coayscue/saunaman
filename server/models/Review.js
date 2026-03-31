const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const reviewSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  reservation: { type: String, ref: 'Reservation', required: true },
  user: { type: String, ref: 'User', required: true },
  event: { type: String, ref: 'Event', required: true },
  stars: { type: Number, required: true, min: 1, max: 5 },
  text: { type: String },
  photos: [{ type: String }], // filenames in uploads/reviews/
  name: { type: String, required: true } // display name for the review
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
