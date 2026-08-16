// Shared security utilities for the dashboard
// Prevents IDOR, XSS (from stored data), and mass assignment

/**
 * IDOR protection: ensure the logged-in user actually has ADMINISTRATOR
 * permission in the target guild (verified from the fresh Discord OAuth guilds list).
 * Admin owners bypass the guild check (they own everything).
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
  const guild = userGuilds.find(g => g.id === guildId);
  if (!guild) {
    return res.status(403).json({ success: false, error: 'GUILD_NOT_FOUND' });
  }
  const perms = BigInt(guild.permissions || 0);
  const hasAdmin = (perms & BigInt(0x8)) === BigInt(0x8); // ADMINISTRATOR
  const hasManage = (perms & BigInt(0x20)) === BigInt(0x20); // MANAGE_GUILD
  if (!hasAdmin && !hasManage) {
    return res.status(403).json({ success: false, error: 'GUILD_ACCESS_DENIED' });
  }
  next();
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
