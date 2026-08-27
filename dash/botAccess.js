'use strict';

function getBotMembership(botClient, guildId) {
  const id = String(guildId || '').trim();
  if (!id) return { state: 'unknown', installed: false };
  if (!botClient || !botClient.guilds || !botClient.guilds.cache) return { state: 'unknown', installed: false };
  const installed = typeof botClient.guilds.cache.has === 'function'
    ? botClient.guilds.cache.has(id)
    : Boolean(typeof botClient.guilds.cache.get === 'function' && botClient.guilds.cache.get(id));
  return { state: installed ? 'installed' : 'absent', installed };
}

function buildBotInviteUrl(clientId) {
  const id = String(clientId || '').trim();
  if (!id) return null;
  const params = new URLSearchParams({
    client_id: id,
    scope: 'bot applications.commands',
    permissions: '0',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function botAccessDecision(membership) {
  if (membership?.state === 'installed') return { allow: true, status: 200, error: null };
  if (membership?.state === 'absent') return { allow: false, status: 409, error: 'bot_not_in_server' };
  return { allow: false, status: 503, error: 'bot_membership_unavailable' };
}

function botAccessPayload(guild, membership, inviteUrl) {
  const installed = membership?.state === 'installed';
  return {
    botInstalled: installed,
    botStatus: membership?.state || 'unknown',
    inviteUrl: installed ? null : inviteUrl,
    guildId: String(guild?.id || ''),
    guildName: guild?.name || null,
  };
}

module.exports = { botAccessDecision, botAccessPayload, buildBotInviteUrl, getBotMembership };
