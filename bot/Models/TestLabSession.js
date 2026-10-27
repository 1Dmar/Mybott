const mongoose = require('mongoose');

const botSchema = new mongoose.Schema({
  username: { type: String, required: true, maxlength: 16 },
  status: { type: String, enum: ['pending', 'connecting', 'online', 'offline', 'error'], default: 'pending' },
  joinedAt: { type: Date, default: null },
  leftAt: { type: Date, default: null },
  lastError: { type: String, default: null, maxlength: 500 },
}, { _id: false });

const testLabSessionSchema = new mongoose.Schema({
  serverId: { type: String, required: true, index: true, maxlength: 64 },
  host: { type: String, required: true, maxlength: 255 },
  port: { type: Number, required: true, min: 1, max: 65535 },
  requestedBots: { type: Number, required: true, min: 1, max: 25 },
  durationMinutes: { type: Number, required: true, min: 1, max: 120 },
  chatScript: { type: [String], default: [] },
  chatIntervalSeconds: { type: Number, default: 30, min: 5, max: 600 },
  status: { type: String, enum: ['draft', 'starting', 'running', 'stopping', 'stopped', 'completed', 'failed'], default: 'draft', index: true },
  startedAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
  stoppedAt: { type: Date, default: null },
  botsConnected: { type: Number, default: 0 },
  instanceId: { type: String, required: true, unique: true },
  bots: { type: [botSchema], default: [] },
  lastError: { type: String, default: null, maxlength: 1000 },
  createdBy: { type: String, required: true, index: true },
}, { timestamps: true });

testLabSessionSchema.index({ serverId: 1, createdAt: -1 });
testLabSessionSchema.index({ endsAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.models.ProMcBotTestLabSession || mongoose.model('ProMcBotTestLabSession', testLabSessionSchema);
