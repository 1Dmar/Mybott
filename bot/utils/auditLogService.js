const AuditLog = require('../Models/AuditLog');

function safeMetadata(metadata = {}) {
  const blocked = /token|secret|password|key|credential/i;
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !blocked.test(key)).slice(0, 30));
}

async function recordAudit({ actorId = null, guildId, action, feature, result, source, target = null, metadata = {} }) {
  if (!guildId || !action || !feature || !result || !source) return null;
  return AuditLog.create({ actorId, guildId, action: String(action).slice(0, 120), feature: String(feature).slice(0, 120), result, source: String(source).slice(0, 120), target: target ? String(target).slice(0, 255) : null, metadata: safeMetadata(metadata), expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) });
}

module.exports = { recordAudit };
