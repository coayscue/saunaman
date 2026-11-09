const mongoose = require("mongoose");
module.exports = mongoose.model("CalendarOAuthState", new mongoose.Schema({
  _id: String,
  expiresAt: { type: Date, expires: 0 },
}));
