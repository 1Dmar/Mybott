const { Schema, model } = require('mongoose');

const schema = new Schema({
  accountId: { type: Schema.Types.ObjectId, ref: 'PlayerAccount', required: true, index: true },
  uuid: { type: String, required: true, trim: true },
  username: { type: String, required: true, trim: true, maxlength: 32 },
  accountType: { type: String, enum: ['online', 'offline', 'unknown'], default: 'unknown' },
  verificationLevel: { type: String, enum: ['plugin_proof', 'server_scoped', 'manual_merge'], default: 'plugin_proof' },
  verifiedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });

schema.index({ accountId: 1, uuid: 1 }, { unique: true });
schema.index({ uuid: 1, accountId: 1 });
module.exports = model('MinecraftIdentity', schema);
