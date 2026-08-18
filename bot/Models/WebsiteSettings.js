const { Schema, model } = require('mongoose');

// Minecraft server website settings (per Discord guild)
// Powers the public site at /site/:guildId
module.exports = model(
  'website-settings',
  new Schema({
    guildId: { type: String, required: true, unique: true },
    // General
    siteName: { type: String, default: '' },
    siteDescription: { type: String, default: '' },
    tagline: { type: String, default: '' },
    heroTitle: { type: String, default: '' },
    heroSubtitle: { type: String, default: '' },
    // Minecraft connection info (editable from dashboard)
    javaIP: { type: String, default: '' },
    javaPort: { type: Number, default: 25565 },
    bedrockIP: { type: String, default: '' },
    bedrockPort: { type: Number, default: 19132 },
    serverType: { type: String, default: 'java' },
    copyIP: { type: String, default: '' }, // IP shown in "Copy IP" button
    // Branding
    logoUrl: { type: String, default: '' },
    accentColor: { type: String, default: '#4070f4' },
    // Template & visibility
    template: { type: String, default: 'neon', enum: ['neon', 'royal', 'minimal'] },
    enabled: { type: Boolean, default: true },
    // Feature toggles
    sections: {
      showLeaderboard: { type: Boolean, default: true },
      showPlayers: { type: Boolean, default: true },
      showNews: { type: Boolean, default: true },
      showDiscord: { type: Boolean, default: true },
    },
    // Socials
    socials: {
      discord: { type: String, default: '' },
      twitter: { type: String, default: '' },
      youtube: { type: String, default: '' },
      tiktok: { type: String, default: '' },
    },
    // Leaderboard config (data is fetched live from the ProMcSecure API when available)
    leaderboard: {
      title: { type: String, default: 'Top Players' },
      metric: { type: String, default: 'elo', enum: ['elo', 'wins', 'kills'] },
      label: { type: String, default: 'ELO' },
    },
    // News items (advanced editor)
    news: [
      {
        title: { type: String },
        body: { type: String },
        date: { type: Date, default: Date.now },
        tag: { type: String, default: 'Update' },
      },
    ],
    // Custom domain & subdomain support
    customSubdomain: { type: String, default: '', trim: true },
    customDomain: { type: String, default: '', trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  })
);

// Fast indexes for public site resolution (host-matching)
try {
  const W = require('mongoose').model('website-settings');
  W.schema.index({ guildId: 1 });
  W.schema.index({ customDomain: 1 });
  W.schema.index({ customSubdomain: 1 });
  W.syncIndexes().catch(() => {});
} catch (_) {}
