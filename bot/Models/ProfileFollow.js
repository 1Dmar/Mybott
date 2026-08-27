const { Schema, model } = require('mongoose');

const profileFollowSchema = new Schema({
  followerId: { type: String, required: true, trim: true },
  profileUserId: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

profileFollowSchema.index({ followerId: 1, profileUserId: 1 }, { unique: true });
profileFollowSchema.index({ profileUserId: 1, createdAt: -1 });

module.exports = model('ProfileFollow', profileFollowSchema);
