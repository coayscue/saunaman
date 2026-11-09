const mongoose = require("mongoose");
module.exports = mongoose.model("CalendarConnection", new mongoose.Schema({
  _id: { type: String, default: "saunaman" },
  calendarId: String,
  token: String,
  syncToken: String,
  syncLease: Date,
  syncOwner: String,
  syncCheckedAt: Date,
  syncError: String,
  status: { type: String, default: "connected" },
}, { timestamps: true }));
