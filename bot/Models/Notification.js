const { Schema, model } = require("mongoose");

module.exports = model(
  "notifications-promc",
  new Schema({
    // ── Who sent it ───────────────────────────────────────────────
    sentBy:        { type: String },
    sentByUsername:{ type: String },

    // ── Target ────────────────────────────────────────────────────
    // user      → send to one Discord user (targetUserId via DM)
    // channel   → send to one text channel (targetGuildId + targetChannelId)
    // guild     → announce in one server (targetGuildId, all members get it)
    // broadcast → announce to ALL servers (all joined guilds)
    // everyone  → DM every registered dashboard user (Api model)
    targetType:    { type: String, enum: ['user', 'channel', 'guild', 'broadcast', 'everyone'], default: 'broadcast' },
    targetUserId:  { type: String },
    targetGuildId: { type: String },
    targetChannelId: { type: String },
    targetRole:    { type: String },   // role id for role mentions inside guild/broadcast

    // ── Content (Discord embed) ───────────────────────────────────
    title:       { type: String, default: '' },
    description: { type: String, default: '' },
    color:       { type: String, default: '#007bff' },
    imageUrl:    { type: String },
    footer:      { type: String },
    fields:      [{ name: String, value: String, inline: { type: Boolean, default: false } }],

    // ── Scheduling ────────────────────────────────────────────────
    scheduledAt: { type: Date },          // null = send immediately
    repeat:      { type: String, enum: ['once', 'hourly', 'daily', 'weekly'], default: 'once' },
    status:      { type: String, enum: ['pending', 'sent', 'failed', 'cancelled'], default: 'pending' },

    // ── Delivery tracking ─────────────────────────────────────────
    stats: {
      total:   { type: Number, default: 0 },
      success: { type: Number, default: 0 },
      failed:  { type: Number, default: 0 }
    },
    lastDeliveredAt: { type: Date },
    lastError:       { type: String },

    createdAt: { type: Date, default: Date.now }
  })
);
