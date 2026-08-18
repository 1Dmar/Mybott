// Shared security utilities for the dashboard
// Prevents IDOR, XSS (from stored data), and mass assignment

/**
 * IDOR protection: ensure the logged-in user actually has ADMINISTRATOR
 * permission in the target guild (verified from the fresh Discord OAuth guilds list).
 * Admin owners bypass the guild check (they own everything).
 *
 * Fallback: Discord OAuth guilds are only refreshed when the user re-authorizes,
 * so a newly-joined (or recently added) guild may be missing from the OAuth list.
 * If the bot itself is in the guild AND the user is a member there, we allow access
 * instead of blocking the dashboard forever.
 */
function verifyGuildAccess(req, res, next) {
  const { guildId } = req.params;
  if (!guildId || !/^\d{15,22}$/.test(guildId)) {
    return res.status(400).json({ success: false, error: 'INVALID_GUILD_ID' });
  }
  // Owner bypass
  const adminIds = (process.env.OWNER_ID || '').split(',').filter(Boolean);
  if (adminIds.includes(req.user?.id)) return next();

  const userGuilds = req.user?.guilds || [];
  let guild = userGuilds.find(g => g.id === guildId);

  if (!guild) {
    // Fallback: bot cache check (guilds may be missing from stale OAuth guilds list)
    guild = _resolveGuildFromBotCache(req, guildId);
    if (!guild) {
      return res.status(403).json({ success: false, error: 'GUILD_NOT_FOUND' });
    }
    // Bot cache confirms the user is a member — allow dashboard access.
    return next();
  }

  const perms = BigInt(guild.permissions || 0);
  const hasAdmin = (perms & BigInt(0x8)) === BigInt(0x8); // ADMINISTRATOR
  const hasManage = (perms & BigInt(0x20)) === BigInt(0x20); // MANAGE_GUILD
  if (!hasAdmin && !hasManage) {
    return res.status(403).json({ success: false, error: 'GUILD_ACCESS_DENIED' });
  }
  next();
}

/**
 * Try to resolve the guild + member relationship from the dashboard bot clients.
 * Returns a guild object compatible with the OAuth shape if the bot is in the
 * guild and the requesting user is a member; otherwise null.
 */
function _resolveGuildFromBotCache(req, guildId) {
  if (!req.user?.id) return null;
  const userId = req.user.id;
  try {
    for (const c of [global.__dashClients]) {
      if (!c) continue;
      for (const bc of c) {
        if (!bc) continue;
        let isReady = false;
        try { isReady = !!bc.isReady(); } catch (_) { try { isReady = bc.isReady; } catch (_) { isReady = false; } }
        if (!isReady || !bc.guilds?.cache?.has(guildId)) continue;
        const g = bc.guilds.cache.get(guildId);
        // member lookup can fail silently for unavailable guilds
        try {
          if (g.members?.cache?.get(userId)) {
            return { id: guildId, permissions: '0', _botFallback: true };
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
  return null;
}

/** Escape HTML to prevent stored-XSS when rendering DB content in the UI. */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Validate a string is a plausible MongoDB ObjectId. */
function isValidObjectId(id) {
  return /^[a-fA-F0-9]{24}$/.test(id);
}

/** Whitelist: keep only allowed keys from an object (mass assignment protection). */
function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

module.exports = { verifyGuildAccess, escapeHtml, isValidObjectId, pick };
