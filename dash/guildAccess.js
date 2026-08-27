'use strict';

const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

function ownerIdsFromEnv(value = process.env.OWNER_ID) {
  return String(value || '').split(',').map(id => id.trim()).filter(Boolean);
}

function permissionFlagsFor(guild) {
  try {
    return BigInt(guild?.permissions || 0);
  } catch (_) {
    return null;
  }
}

/**
 * Returns the user's real Discord role for this guild plus any separate
 * platform-level override. The override authorizes access but never masks
 * the Discord role shown in the dashboard.
 */
function managePermissionDetail(guild, userId, ownerIds = ownerIdsFromEnv()) {
  const isPlatformOwner = ownerIds.includes(String(userId || ''));
  if (guild?.owner === true) {
    return { canManage: true, label: 'owner', source: 'discord_owner', isPlatformOwner };
  }

  const permissions = permissionFlagsFor(guild);
  if (permissions !== null) {
    if ((permissions & ADMINISTRATOR) === ADMINISTRATOR) {
      return { canManage: true, label: 'administrator', source: 'discord_administrator', isPlatformOwner };
    }
    if ((permissions & MANAGE_GUILD) === MANAGE_GUILD) {
      return { canManage: true, label: 'manage_guild', source: 'discord_manage_guild', isPlatformOwner };
    }
  }

  if (isPlatformOwner) {
    return { canManage: true, label: 'platform_owner', source: 'platform_owner_override', isPlatformOwner: true };
  }
  return { canManage: false, label: null, source: null, isPlatformOwner: false };
}

function managePermissionFor(guild, userId, ownerIds = ownerIdsFromEnv()) {
  return managePermissionDetail(guild, userId, ownerIds).label;
}

function getManageableGuilds(user, ownerIds = ownerIdsFromEnv()) {
  const guilds = Array.isArray(user?.guilds) ? user.guilds : [];
  return guilds.reduce((result, guild) => {
    const permission = managePermissionDetail(guild, user.id, ownerIds);
    if (permission.canManage) result.push({
      ...guild,
      managePermission: permission.label,
      permissionSource: permission.source,
      isPlatformOwner: permission.isPlatformOwner,
    });
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

module.exports = {
  ADMINISTRATOR,
  MANAGE_GUILD,
  canManageGuild,
  getManageableGuilds,
  managePermissionDetail,
  managePermissionFor,
  ownerIdsFromEnv,
  resolveGuildReference,
};
