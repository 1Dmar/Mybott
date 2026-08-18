const { Schema, model } = require("mongoose");

module.exports = model(
  "UserFollow",
  new Schema({
    followerId: { type: String, required: true },
    followingId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }).index({ followerId: 1, followingId: 1 }, { unique: true })
);
