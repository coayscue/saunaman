const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const weekly = Array.from({ length: 7 }, (_, index) => ({ weekday: index + 1, startMinute: index >= 5 ? 540 : 1020, endMinute: index >= 5 ? 1200 : 1260 }));
const scheduleSchema = new mongoose.Schema({
  _id: { type: String, default: 'saunaman' },
  revision: { type: Number, default: 0 },
  syncLease: Date, syncOwner: String, syncError: String,
  weekly: { type: [{ weekday: Number, startMinute: Number, endMinute: Number }], default: () => weekly },
}, { timestamps: true });
const ruleSchema = new mongoose.Schema({
  _id: { type: String, default: randomUUID },
  kind: { type: String, enum: ['available', 'blocked'], required: true },
  fromDate: { type: String, required: true },
  toDate: { type: String, required: true },
  startMinute: Number,
  endMinute: Number,
  deleted: { type: Boolean, default: false },
  revision: { type: Number, default: 0 },
}, { timestamps: true });
const mirrorSchema = new mongoose.Schema({
  _id: String, calendarId: String, googleEventId: String,
  contentHash: String, active: Boolean, error: String,
}, { timestamps: true });
module.exports = {
  Schedule: mongoose.model('AvailabilitySchedule', scheduleSchema),
  Rule: mongoose.model('AvailabilityRule', ruleSchema),
  Mirror: mongoose.model('AvailabilityMirror', mirrorSchema),
  defaultWeekly: weekly,
};
