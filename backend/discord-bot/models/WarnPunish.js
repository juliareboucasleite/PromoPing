// models/WarnPunish.js
const mongoose = require("mongoose");

const warnPunishSchema = new mongoose.Schema({
  guildId: String,
  warnCount: Number, // how many warns until punishment
  action: String, // mute, kick, ban
  duration: String, // only for mute (e.g. "1h", "30m"), optional
});

module.exports = mongoose.model("WarnPunish", warnPunishSchema);



