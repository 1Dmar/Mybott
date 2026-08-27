const Blacklist = require('../Models/BlackList');

function isBlacklistActive(entry, now = Date.now()) {
  if (!entry || entry.isBlacklisted !== 'true') return false;
  if (entry.isPermanent) return true;
  const expiresAt = Number(entry.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

async function getActiveBlacklist(guildId, now = Date.now()) {
  const id = String(guildId || '').trim();
  if (!id) return null;
  const entry = await Blacklist.findOne({ guildIds: id });
  if (!entry) return null;
  if (isBlacklistActive(entry, now)) return entry;
  if (!entry.isPermanent && Number(entry.expiresAt) && Number(entry.expiresAt) <= now) {
    await Blacklist.deleteOne({ _id: entry._id });
  }
  return null;
}

module.exports = { isBlacklistActive, getActiveBlacklist };
