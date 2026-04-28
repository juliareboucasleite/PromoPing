const mongoose = require("mongoose");

const applicationSubmissionSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  applicationId: { type: Number, required: true },
  userId: { type: String, required: true },
  status: { type: String, default: "pending" },
  answers: { type: Array, default: [] },
  reviewMessageId: { type: String, default: null },
  reviewerId: { type: String, default: null },
  decisionReason: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports =
  mongoose.models.ApplicationSubmission ||
  mongoose.model("ApplicationSubmission", applicationSubmissionSchema);
