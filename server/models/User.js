const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  credits: { type: Number, default: 0 },
  signedWaiver: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
