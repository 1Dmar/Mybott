const { Schema, model } = require("mongoose");

/**
 * Unified Minecraft Server Information Model
 * Combines basic server info, connection details, and API configuration.
 */
const serverSchema = new Schema({
  serverId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  serverName: {
    type: String,
    default: 'Minecraft Server'
  },
  // Basic Connection Info
  javaIP: { type: String },
  javaPort: { type: Number, default: 25565 },
  bedrockIP: { type: String },
  bedrockPort: { type: Number, default: 19132 },
  serverType: { 
    type: String, 
    enum: ['java', 'bedrock', 'custom'],
    default: 'java' 
  },
  
  // Customization
  wallpaper: {
    type: String,
    default: "https://i.ibb.co/TBVZycXV/2.png"
  },
  
  // Advanced API Integration (Plugin required on MC Server)
  apiUrl: { type: String }, // Combined from javaIP/Port or specific endpoint
  apiToken: { type: String, default: null },
  apiPort: { type: Number, default: null },
  premiumKey: { type: String, default: null },
  
  // Analytics & Stats
  interactionsCount: {
    type: Number,
    default: 0
  },
  lastStatusCheck: { type: Date },
  isOnline: { type: Boolean, default: false },
  
  // Timestamps
  updatedAt: { type: Date, default: Date.now }
});

// Auto-update timestamp
serverSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = model("serverinformations-promc", serverSchema);
