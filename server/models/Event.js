const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const eventSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuidv4 },
    name: { type: String, required: true },
    date: { type: Date, required: true },
    duration: { type: Number, default: 120 },
    price: { type: Number, required: true },
    max_capacity: { type: Number, required: true },
    type: { type: String, enum: ["public", "private"], required: true },
    googleCalendarId: String,
    googleEventId: String,
    googleEtag: String,
    syncEnabled: { type: Boolean, default: false },
    syncVersion: { type: Number, default: 0 },
    syncBase: String,
    syncStatus: { type: String, default: 'unlinked' },
    syncError: String,
    lastSyncedAt: Date,
    syncNoticeKey: String,
    syncNoticePayload: String,
    syncNotifiedKey: String,
    cancellationState: { type: String, enum: ['active', 'cancelling', 'cancelled'], default: 'active' },
    cancellationError: String,
    cancellationNotificationsComplete: { type: Boolean, default: false },
    cancellationLease: Date,
    cancellationOwner: String,
    deleteRequested: { type: Boolean, default: false },
    deletedAt: Date,
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
