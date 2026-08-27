'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canManageGuild, getManageableGuilds, managePermissionFor } = require('../dash/guildAccess');

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

test('guild access does not throw for malformed permissions and supports configured owner override', () => {
  const user = { id: 'owner-1', guilds: [{ id: 'owned', permissions: 'not-a-number' }, { id: 'broken', permissions: null }] };
  assert.equal(managePermissionFor(user.guilds[0], user.id, ['owner-1']), 'owner');
  assert.equal(managePermissionFor(user.guilds[1], 'other-user', []), null);
  assert.deepEqual(getManageableGuilds(user, ['owner-1']).map(guild => guild.id), ['owned', 'broken']);
});

test('guild access preserves Discord permission strings above JavaScript safe integer range', () => {
  const user = { id: 'user-2', guilds: [{ id: 'large', permissions: '1099511627776' }] };
  assert.equal(canManageGuild(user, 'large', []), false);
});
