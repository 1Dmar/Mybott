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

async function resolveBotMembership(botClient, guildId) {
  const cached = getBotMembership(botClient, guildId);
  if (cached.state === 'installed') return { ...cached, guild: botClient.guilds.cache.get(String(guildId)) };
  if (!botClient?.guilds || typeof botClient.guilds.fetch !== 'function') return { state: 'unknown', installed: false };
  try {
    const guild = await botClient.guilds.fetch(String(guildId));
    return guild ? { state: 'installed', installed: true, guild } : { state: 'unknown', installed: false };
  } catch (error) {
    const code = String(error?.code || '');
    if (code === '10004' || code === '50001' || error?.status === 404) return { state: 'absent', installed: false };
    return { state: 'unknown', installed: false };
  }
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

module.exports = { botAccessDecision, botAccessPayload, buildBotInviteUrl, getBotMembership, resolveBotMembership };
