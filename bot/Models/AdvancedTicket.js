// ── Advanced Ticket System (promcbot.dev/my-servers/:id/advanced-tickets) ──
// Extends the basic Ticket model with: categories, priorities, assignments,
// SLA timers, tags, internal notes and resolution stats. This is what big
// MC servers need to handle hundreds of support tickets without drowning.
const { Schema, model } = require("mongoose");

module.exports = model(
  "advanced-tickets1",
  new Schema({
    // Server id
    guildId: { type: String, required: true, index: true },
    // Unique readable ticket id like #0042
    ticketId: { type: String, required: true, index: true },
    // Discord channel hosting the ticket (if opened in Discord)
    channelId: { type: String },
    // Reporter
    userId: { type: String, required: true, index: true },
    userName: { type: String, maxlength: 80 },
    // Categorization
    category: {
      type: String,
      enum: ["bug", "appeal", "purchase", "question", "report", "other"],
      default: "other",
      index: true
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium"
    },
    // Subject + first message
    subject: { type: String, maxlength: 200 },
    firstMessage: { type: String, maxlength: 2000 },
    // Assignment: staff member(s) handling it
    assignedTo: [{ type: String }],
    // CC watchers
    watchers: [{ type: String }],
    // Workflow state
    status: {
      type: String,
      enum: ["open", "waiting", "in-progress", "resolved", "closed"],
      default: "open",
      index: true
    },
    // Why is it "waiting"? (e.g. waiting on user reply)
    waitingReason: { type: String, maxlength: 300 },
    // Tags like "premium", "whitelist", "grief"
    tags: [{ type: String, maxlength: 40 }],
    // Internal notes visible only to staff (not synced to Discord channel)
    internalNotes: [{
      by: { type: String },
      byName: { type: String, maxlength: 80 },
      note: { type: String, maxlength: 1000 },
      at: { type: Date, default: Date.now }
    }],
    // Message log kept in DB for stats even if channel is deleted
    messagesCount: { type: Number, default: 0, min: 0 },
    // Timestamps
    openedAt: { type: Date, default: Date.now },
    firstResponseAt: { type: Date },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    // Resolution record
    resolvedBy: { type: String },
    resolvedByUser: { type: String, maxlength: 80 },
    resolutionNote: { type: String, maxlength: 1000 },
    // Satisfaction rating from user (1-5)
    rating: { type: Number, min: 1, max: 5 },
    // SLA clock: deadline based on priority
    slaDeadline: { type: Date },
    slaBreached: { type: Boolean, default: false }
  }, { timestamps: true })
);

// SLA hours per priority (staff can tune)
module.exports.SLA_HOURS = { low: 48, medium: 24, high: 8, critical: 2 };

module.exports.computeDeadline = (priority, now = Date.now()) => {
  const hours = module.exports.SLA_HOURS[priority] || 24;
  return new Date(now + hours * 3600 * 1000);
};
