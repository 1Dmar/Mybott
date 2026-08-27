const { Schema, model } = require('mongoose');

const profileLikeSchema = new Schema({
  likerId: { type: String, required: true, trim: true },
  profileUserId: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

profileLikeSchema.index({ likerId: 1, profileUserId: 1 }, { unique: true });
profileLikeSchema.index({ profileUserId: 1, createdAt: -1 });

module.exports = model('ProfileLike', profileLikeSchema);
