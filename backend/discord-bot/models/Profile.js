const { Schema, model } = require("mongoose");

const ProfileSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  bio: { type: String, default: "This user has no bio yet." },
  badges: { type: [String], default: [] }, // will store keys like 'VIP', 'Owner
  backgroundKey: { type: String, default: null },
  backgroundPath: { type: String, default: null },
});

module.exports = model("Profile", ProfileSchema);



