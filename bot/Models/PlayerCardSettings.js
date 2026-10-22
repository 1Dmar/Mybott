const { Schema, model } = require('mongoose');

const schema = new Schema({
  accountId: { type: Schema.Types.ObjectId, ref: 'PlayerAccount', required: true, unique: true, index: true },
  template: { type: String, enum: ['darkmode', 'glass', 'minimal', 'minecraft'], default: 'minecraft' },
  accentColor: { type: String, match: /^#[0-9a-fA-F]{6}$/, default: '#5865f2' },
  bio: { type: String, maxlength: 240, default: '' },
  publicEnabled: { type: Boolean, default: true },
  fields: {
    showDiscord: { type: Boolean, default: true },
    showMinecraft: { type: Boolean, default: true },
    showGlobalStats: { type: Boolean, default: true },
    showServerStats: { type: Boolean, default: true },
    showAchievements: { type: Boolean, default: true },
  },
}, { timestamps: true, versionKey: false });

module.exports = model('PlayerCardSettings', schema);
