'use strict';

const DEFAULT_AUTOMOD = Object.freeze({
  enabled: false,
  action: 'warn',
  logChannel: '',
  filters: Object.freeze({ badwords: false, links: false, invites: false, spam: false, caps: false, mentions: false }),
  limits: Object.freeze({ capsPercentage: 70, spamCount: 5, spamInterval: 5000, maxMentions: 5 }),
});

function normalizeAutomod(value) {
  const source = value && typeof value === 'object' ? value : {};
  const action = ['warn', 'mute', 'kick', 'ban', 'delete', 'timeout'].includes(source.action) ? source.action : DEFAULT_AUTOMOD.action;
  return {
    enabled: source.enabled === true,
    action,
    logChannel: typeof source.logChannel === 'string' ? source.logChannel.slice(0, 64) : '',
    filters: { ...DEFAULT_AUTOMOD.filters, ...(source.filters && typeof source.filters === 'object' ? source.filters : {}) },
    limits: { ...DEFAULT_AUTOMOD.limits, ...(source.limits && typeof source.limits === 'object' ? source.limits : {}) },
  };
}

module.exports = { DEFAULT_AUTOMOD, normalizeAutomod };
