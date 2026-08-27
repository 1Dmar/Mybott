'use strict';

const { getForGuild } = require('./entitlementService');
const { hasFeature } = require('./entitlements');

function isModerationEntitled(entitlement) {
  return hasFeature(entitlement, 'moderation.advanced');
}

async function checkModerationEntitlement(guildId) {
  try {
    const entitlement = await getForGuild(guildId);
    return isModerationEntitled(entitlement)
      ? { ok: true, entitlement }
      : { ok: false, entitlement, reason: 'feature_requires_pro' };
  } catch (error) {
    return { ok: false, reason: 'entitlement_unavailable' };
  }
}

async function requireProModeration(interaction) {
  const result = await checkModerationEntitlement(interaction.guildId || interaction.guild?.id);
  if (result.ok) return result;
  const content = result.reason === 'entitlement_unavailable'
    ? 'Moderation is temporarily unavailable because plan verification could not complete.'
    : 'Auto-moderation requires the Pro plan. Open the server-scoped Premium page to upgrade.';
  return { ...result, response: { content, ephemeral: true } };
}

module.exports = { isModerationEntitled, checkModerationEntitlement, requireProModeration };
