const SecurityEvent = require('../Models/SecurityEvent');

async function recordSecurityEvent({ guildId, instanceId = null, event, severity = 'medium', evidence = {}, action = 'review' }) {
  if (!guildId || !event) return null;
  return SecurityEvent.create({ guildId, instanceId, event, severity, evidence, source: 'plugin_protocol', action, expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) });
}

module.exports = { recordSecurityEvent };
