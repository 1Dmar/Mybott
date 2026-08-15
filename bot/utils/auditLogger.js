/**
 * auditLogger — Real audit log system for the dashboard.
 *
 * Every moderation/guild action is recorded in the `serveroptions-activity`
 * collection (Activity model: { serverId, activities[{user,action,reason,timestamp}] })
 * which the dashboard "Audit Logs" page reads from.
 *
 * Keeps at most MAX_ENTRIES entries per server to avoid unbounded growth.
 */
const Activity = require('../Models/Activity');

const MAX_ENTRIES = 500;

async function logActivity(serverId, entry) {
  if (!serverId || !entry || !entry.action) return;
  entry.user = String(entry.user || 'System');
  entry.reason = entry.reason ? String(entry.reason).slice(0, 500) : undefined;
  try {
    await Activity.findOneAndUpdate(
      { serverId: String(serverId) },
      { $push: { activities: { $each: [entry], $position: 0 } } },
      { upsert: true }
    );
    // Trim old entries beyond MAX_ENTRIES
    await Activity.updateOne(
      { serverId: String(serverId) },
      { $set: { activities: { $slice: [MAX_ENTRIES] } } }
    );
  } catch (err) {
    console.error('[AuditLog] Failed to record activity:', err.message);
  }
}

module.exports = { logActivity, MAX_ENTRIES };
