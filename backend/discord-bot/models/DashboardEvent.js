const mongoose = require("mongoose");

const dashboardEventSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    type: { type: String, required: true, index: true },
    source: { type: String, default: "bot" },
    severity: { type: String, default: "info" },
    actorId: { type: String, default: null },
    actorTag: { type: String, default: null },
    commandName: { type: String, default: null },
    channelId: { type: String, default: null },
    summary: { type: String, required: true },
    details: { type: Object, default: {} },
    createdAt: { type: Date, default: Date.now, index: true }
  },
  { minimize: false }
);

module.exports =
  mongoose.models.DashboardEvent ||
  mongoose.model("DashboardEvent", dashboardEventSchema);
