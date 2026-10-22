const { Schema, model } = require('mongoose');

const schema = new Schema({
  discordUserId: { type: String, required: true, index: true },
  serverId: { type: String, required: true, index: true },
  codeHash: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'consumed', 'expired', 'rejected'], default: 'pending', index: true },
  expiresAt: { type: Date, required: true, index: true },
  consumedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

schema.index({ serverId: 1, codeHash: 1, status: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = model('PlayerLinkClaim', schema);
