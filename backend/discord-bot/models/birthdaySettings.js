const mongoose = require("mongoose");

const birthdaySettingsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String }, // channel for birthday messages
  roleId: { type: String }, // optional birthday role
  message: { type: String, default: "🎉 Happy Birthday, {user}!" }, // customizable template
  enabled: { type: Boolean, default: true },
});

module.exports = mongoose.model("BirthdaySettings", birthdaySettingsSchema);



