const mongoose = require("mongoose");

const caseSchema = new mongoose.Schema({
  guildId: String,
  caseId: Number,
  userId: String,
  moderatorId: String,
  action: { type: String, default: "warn" },
  reason: { type: String, default: "No reason provided" },
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Case || mongoose.model("Case", caseSchema);



