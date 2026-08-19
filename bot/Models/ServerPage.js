// ── Public Server Page (promcbot.dev/s/:serverId) ─────────────────
// The public showcase page every server owner can enable from the dashboard.
const { Schema, model } = require("mongoose");
module.exports = model(
  "server-pages-promc",
  new Schema({
    // Discord guild this page belongs to
    guildId: { type: String, required: true, unique: true, index: true },
    // Public display name (defaults to serverName from Server model)
    publicName: { type: String },
    // Short description shown under the name
    description: { type: String, maxlength: 300 },
    // Logo/banner URLs (defaults: Server.wallpaper + guild avatar)
    logoUrl: { type: String },
    bannerUrl: { type: String },
    // Discord invite link shown on the page
    discordInvite: { type: String },
    // Show this server in the public directory (promcbot.dev/servers)
    showInDirectory: { type: Boolean, default: false },
    // Manual featured placement (admin controlled)
    featured: { type: Boolean, default: false },
    // Status flags (auto-updated by system checker)
    wasOffline: { type: Boolean, default: false },
    registeredAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  })
);
