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

function getManageableGuilds(user, ownerIds = ownerIdsFromEnv()) {
  const guilds = Array.isArray(user?.guilds) ? user.guilds : [];
  return guilds.reduce((result, guild) => {
    const managePermission = managePermissionFor(guild, user.id, ownerIds);
    if (managePermission) result.push({ ...guild, managePermission });
    return result;
  }, []);
}

function resolveGuildReference(user, reference, ownerIds = ownerIdsFromEnv()) {
  const value = String(reference || '').trim();
  if (!value) return null;
  const manageable = getManageableGuilds(user, ownerIds);
  return manageable.find(guild => String(guild.id) === value || String(guild.name || '').toLowerCase() === value.toLowerCase()) || null;
}

function canManageGuild(user, guildId, ownerIds = ownerIdsFromEnv()) {
  return Boolean(resolveGuildReference(user, guildId, ownerIds));
}

module.exports = { ADMINISTRATOR, MANAGE_GUILD, canManageGuild, getManageableGuilds, managePermissionFor, ownerIdsFromEnv, resolveGuildReference };
