'use strict';

function getSessionSecret(env = process.env) {
  const configured = String(env.SESSION_SECRET || '').trim();
  if (configured) return configured;
  if (env.NODE_ENV === 'production') throw new Error('session_secret_required');
  return 'development-only-session-secret';
}

function sanitizeDiscordProfile(profile = {}) {
  const safeGuilds = Array.isArray(profile.guilds) ? profile.guilds.map(guild => ({
    id: String(guild?.id || '').slice(0, 32),
    name: String(guild?.name || '').slice(0, 120),
    icon: guild?.icon || null,
    banner: guild?.banner || null,
    owner: guild?.owner === true,
    permissions: String(guild?.permissions || ''),
    features: Array.isArray(guild?.features) ? guild.features.slice(0, 50) : [],
  })).filter(guild => guild.id) : [];
  return {
    id: String(profile.id || '').slice(0, 32),
    username: String(profile.username || '').slice(0, 120),
    global_name: String(profile.global_name || profile.globalName || profile.username || '').slice(0, 120),
    avatar: profile.avatar || null,
    accent_color: profile.accent_color || null,
    email: profile.email || null,
    guilds: safeGuilds,
  };
}

module.exports = { getSessionSecret, sanitizeDiscordProfile };
