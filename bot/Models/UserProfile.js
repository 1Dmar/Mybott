const { Schema, model } = require("mongoose");

module.exports = model(
  "UserProfile",
  new Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, trim: true, lowercase: true, match: /^[a-z0-9_.-]{3,32}$/, unique: true, sparse: true },
    banner: { type: String, default: "" }, // URL or Color
    bannerType: { type: String, default: "color" }, // "color" or "image"
    customStatus: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now }
  })
);
