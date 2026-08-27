'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canManageGuild, getManageableGuilds, managePermissionDetail, managePermissionFor, resolveGuildReference } = require('../dash/guildAccess');

test('guild access includes only owner, administrator, and manage-guild permissions', () => {
  const user = {
    id: 'user-1',
    guilds: [
      { id: 'owner-guild', name: 'Owner', owner: true, permissions: '0' },
      { id: 'admin-guild', name: 'Admin', permissions: '8' },
      { id: 'manager-guild', name: 'Manager', permissions: '32' },
      { id: 'member-guild', name: 'Member', permissions: '0' },
      { id: 'moderator-guild', name: 'Moderator', permissions: '16' },
    ],
  };
  const manageable = getManageableGuilds(user, []);
  assert.deepEqual(manageable.map(guild => [guild.id, guild.managePermission]), [
    ['owner-guild', 'owner'],
    ['admin-guild', 'administrator'],
    ['manager-guild', 'manage_guild'],
  ]);
  assert.equal(canManageGuild(user, 'member-guild', []), false);
  assert.equal(canManageGuild(user, 'manager-guild', []), true);
});

test('platform owner override authorizes access without falsely labeling every guild as Discord Owner', () => {
  const user = {
    id: 'owner-1',
    guilds: [
      { id: 'discord-owner', owner: true, permissions: '0' },
      { id: 'managed', permissions: '32' },
      { id: 'member-only', permissions: '0' },
      { id: 'malformed', permissions: 'not-a-number' },
    ],
  };
  assert.equal(managePermissionFor(user.guilds[0], user.id, ['owner-1']), 'owner');
  assert.equal(managePermissionFor(user.guilds[1], user.id, ['owner-1']), 'manage_guild');
  assert.equal(managePermissionFor(user.guilds[2], user.id, ['owner-1']), 'platform_owner');
  assert.equal(managePermissionFor(user.guilds[3], 'other-user', []), null);
  assert.deepEqual(getManageableGuilds(user, ['owner-1']).map(guild => [guild.id, guild.managePermission, guild.permissionSource]), [
    ['discord-owner', 'owner', 'discord_owner'],
    ['managed', 'manage_guild', 'discord_manage_guild'],
    ['member-only', 'platform_owner', 'platform_owner_override'],
    ['malformed', 'platform_owner', 'platform_owner_override'],
  ]);
});

test('permission detail preserves Discord role and exposes platform override separately', () => {
  assert.deepEqual(managePermissionDetail({ owner: false, permissions: '8' }, 'u', ['u']), {
    canManage: true,
    label: 'administrator',
    source: 'discord_administrator',
    isPlatformOwner: true,
  });
});

test('guild references resolve by managed server name without widening access', () => {
  const user = { id: 'user-3', guilds: [{ id: '123', name: 'Testing', permissions: '32' }, { id: '456', name: 'Read Only', permissions: '0' }] };
  assert.equal(resolveGuildReference(user, 'Testing', [])?.id, '123');
  assert.equal(resolveGuildReference(user, '123', [])?.name, 'Testing');
  assert.equal(resolveGuildReference(user, 'Read Only', []), null);
});

test('guild access preserves Discord permission strings above JavaScript safe integer range', () => {
  const user = { id: 'user-2', guilds: [{ id: 'large', permissions: '1099511627776' }] };
  assert.equal(canManageGuild(user, 'large', []), false);
});
