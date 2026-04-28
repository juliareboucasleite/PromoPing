const mongoose = require("mongoose");

const birthdaySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
});

module.exports = mongoose.model("Birthday", birthdaySchema);



