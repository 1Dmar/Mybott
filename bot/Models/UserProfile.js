const { Schema, model } = require("mongoose");

module.exports = model(
  "UserProfile",
  new Schema({
    userId: { type: String, required: true, unique: true },
    banner: { type: String, default: "" }, // URL or Color
    bannerType: { type: String, default: "color" }, // "color" or "image"
    customStatus: { type: String, default: "" },
    apiKey: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now }
  })
);
