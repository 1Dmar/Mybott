const { Schema, model } = require("mongoose");

// Smart Monitoring: logs every offline event per guild (start/end/duration)
const DowntimeLogSchema = new Schema({
  guildId: { type: String, required: true, index: true },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date },
  ip: String,
  durationMin: Number, // calculated when ended
});
DowntimeLogSchema.index({ guildId: 1, startedAt: -1 });
module.exports = model("downtimelogs-promc", DowntimeLogSchema);
