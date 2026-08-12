const { Schema, model } = require("mongoose");

const userProfileSchema = new Schema({
  userId: { type: String, required: true, index: true },
  guildId: { type: String, required: true, index: true },
  
  // Customization
  banner: { type: String, default: "" }, 
  bannerType: { type: String, default: "color" }, 
  customStatus: { type: String, default: "" },
  
  // Economy & Engagement
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  coins: { type: Number, default: 0 },
  
  // Minecraft Linkage
  mcUsername: { type: String, default: null },
  mcUuid: { type: String, default: null },
  
  updatedAt: { type: Date, default: Date.now }
});

// Ensure unique profile per guild
userProfileSchema.index({ userId: 1, guildId: 1 }, { unique: true });

userProfileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = model("UserProfile", userProfileSchema);
