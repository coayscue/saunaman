const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const eventSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuidv4 },
    name: { type: String, required: true },
    date: { type: Date, required: true },
    endDate: { type: Date },
    duration: { type: Number, default: 120 },
    price: { type: Number, required: true },
    max_capacity: { type: Number, required: true },
    type: { type: String, enum: ["public", "private"], required: true },
    booked: { type: Boolean, default: false },
    tent_count: { type: Number, enum: [1, 2], default: 1 },
    location: {
      name: { type: String },
      address: { type: String },
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Event", eventSchema);
