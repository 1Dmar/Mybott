// ── In-app dashboard notifications (shown inside the dashboard navbar inbox) ─
// Not Discord messages! These are bell notifications inside promcbot.dev.

const { Schema, model } = require("mongoose");

module.exports = model(
  "notifications-promc",
  new Schema({
    // ── Who is this notification for ──────────────────────────────
    // 'user'      → one dashboard user (recipientId)
    // 'everyone'  → every logged-in user sees it (recipientId = null)
    recipientId: { type: String },        // discordId of the recipient (null = everyone)
    forAdmin:    { type: Boolean, default: false }, // admin-only announcement

    // ── Source ────────────────────────────────────────────────────
    // 'admin'  → from Admin Panel (visible in navbar bell)
    // 'system' → auto save confirmations (hidden from navbar bell)
    source:      { type: String, enum: ['admin', 'system'], default: 'admin' },

    // ── Who created it ────────────────────────────────────────────
    createdBy:       { type: String },
    createdByLabel:  { type: String },   // e.g. 'Admin Panel', 'System'
    systemEvent:     { type: String },   // auto-generated key, e.g. 'config.saved', 'member.joined'

    // ── Content ───────────────────────────────────────────────────
    type:        { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
    title:       { type: String, default: '' },
    message:     { type: String, default: '' },
    actionUrl:   { type: String },       // clickable link inside the notification
    actionLabel: { type: String },       // button text for the link

    // ── State ─────────────────────────────────────────────────────
    read:   { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date }            // auto-clean after date
  })
);
