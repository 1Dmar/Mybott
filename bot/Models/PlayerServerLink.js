const { Schema, model } = require('mongoose');

const schema = new Schema({
  accountId: { type: Schema.Types.ObjectId, ref: 'PlayerAccount', required: true, index: true },
  identityId: { type: Schema.Types.ObjectId, ref: 'MinecraftIdentity', required: true, index: true },
  serverId: { type: String, required: true, index: true },
  instanceId: { type: String, required: true, trim: true, maxlength: 64 },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  privacy: {
    showUsername: { type: Boolean, default: true },
    showStats: { type: Boolean, default: true },
    showServer: { type: Boolean, default: false },
  },
  linkSource: { type: String, enum: ['plugin_claim', 'legacy_migration', 'manual_merge'], default: 'plugin_claim' },
}, { timestamps: true, versionKey: false });

schema.index({ accountId: 1, identityId: 1, serverId: 1 }, { unique: true });
schema.index({ serverId: 1, identityId: 1 });
module.exports = model('PlayerServerLink', schema);
