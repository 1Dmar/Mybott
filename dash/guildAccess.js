'use strict';

const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

function ownerIdsFromEnv(value = process.env.OWNER_ID) {
  return String(value || '').split(',').map(id => id.trim()).filter(Boolean);
}

function managePermissionFor(guild, userId, ownerIds = ownerIdsFromEnv()) {
  if (ownerIds.includes(String(userId || ''))) return 'owner';
  if (guild?.owner === true) return 'owner';
  try {
    const permissions = BigInt(guild?.permissions || 0);
    if ((permissions & ADMINISTRATOR) === ADMINISTRATOR) return 'administrator';
    if ((permissions & MANAGE_GUILD) === MANAGE_GUILD) return 'manage_guild';
  } catch (_) {
    return null;
  }
  return null;
}

function canManageGuild(user, guildId, ownerIds = ownerIdsFromEnv()) {
  if (!user?.id || !guildId) return false;
  const guild = (Array.isArray(user.guilds) ? user.guilds : []).find(item => item?.id === guildId);
  return Boolean(guild && managePermissionFor(guild, user.id, ownerIds));
}

function getManageableGuilds(user, ownerIds = ownerIdsFromEnv()) {
  const guilds = Array.isArray(user?.guilds) ? user.guilds : [];
  return guilds.reduce((result, guild) => {
    const managePermission = managePermissionFor(guild, user.id, ownerIds);
    if (managePermission) result.push({ ...guild, managePermission });
    return result;
  }, []);
}

module.exports = { ADMINISTRATOR, MANAGE_GUILD, canManageGuild, getManageableGuilds, managePermissionFor, ownerIdsFromEnv };
