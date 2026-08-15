/**
 * auditLogger — Records real moderation & guild events for the dashboard Audit Logs page.
 *
 * Listens to: guildBanAdd, guildBanRemove, guildMemberRemove, guildMemberAdd,
 *             messageDelete, messageUpdate, channelCreate, channelDelete, roleCreate, roleDelete
 * Events are stored via auditLogger.logActivity() into the Activity model.
 */
const { logActivity } = require('../utils/auditLogger');

module.exports = {
  name: 'auditLogger',
  execute(client) {
    // ── Bans ─────────────────────────────────────────────────────────────
    client.on('guildBanAdd', async (ban) => {
      try {
        const audit = await ban.guild.fetchAuditLogs({ type: 22, limit: 1 }).catch(() => null);
        const entry = audit?.entries.first();
        const executor = entry?.executor?.tag || 'Unknown';
        logActivity(ban.guild.id, {
          user: executor,
          action: 'Member Banned',
          reason: `Banned ${ban.user.tag}` + (entry?.reason ? ` — ${entry.reason}` : '')
        });
      } catch (err) { console.error('[Audit] guildBanAdd:', err.message); }
    });

    client.on('guildBanRemove', async (ban) => {
      try {
        const audit = await ban.guild.fetchAuditLogs({ type: 23, limit: 1 }).catch(() => null);
        const entry = audit?.entries.first();
        const executor = entry?.executor?.tag || 'Unknown';
        logActivity(ban.guild.id, {
          user: executor,
          action: 'Member Unbanned',
          reason: `Unbanned ${ban.user.tag}` + (entry?.reason ? ` — ${entry.reason}` : '')
        });
      } catch (err) { console.error('[Audit] guildBanRemove:', err.message); }
    });

    // ── Member removal / join ────────────────────────────────────────────
    client.on('guildMemberRemove', async (member) => {
      if (!member || !member.guild || member.user?.bot) return;
      try {
        const tag = member.user ? member.user.tag : 'Unknown';
        logActivity(member.guild.id, {
          user: tag,
          action: 'Member Left / Removed',
          reason: `${tag} left or was removed from the server`
        });
      } catch (err) { console.error('[Audit] guildMemberRemove:', err.message); }
    });

    client.on('guildMemberAdd', async (member) => {
      if (!member || !member.guild || member.user?.bot) return;
      try {
        logActivity(member.guild.id, {
          user: member.user.tag,
          action: 'Member Joined',
          reason: `${member.user.tag} joined the server`
        });
      } catch (err) { console.error('[Audit] guildMemberAdd:', err.message); }
    });

    // ── Messages ─────────────────────────────────────────────────────────
    client.on('messageDelete', async (message) => {
      try {
        if (!message || !message.guild) return;
        const audit = await message.guild.fetchAuditLogs({ type: 72, limit: 1 }).catch(() => null);
        const entry = audit?.entries.first();
        const isModerationDelete = entry && entry.target?.id === (message.author?.id || message.authorId);
        if (!isModerationDelete) return; // only moderation deletes, not normal ones
        logActivity(message.guild.id, {
          user: (entry.executor?.tag) || message.author?.tag || 'Unknown',
          action: 'Message Deleted (Moderation)',
          reason: `Message by ${message.author?.tag || 'Unknown'} was deleted` + (entry?.reason ? ` — ${entry.reason}` : '')
        });
      } catch (err) { console.error('[Audit] messageDelete:', err.message); }
    });

    // ── Channels ─────────────────────────────────────────────────────────
    client.on('channelCreate', async (channel) => {
      if (!channel || !channel.guild) return;
      try {
        logActivity(channel.guild.id, {
          user: 'System',
          action: 'Channel Created',
          reason: `Channel #${channel.name} was created`
        });
      } catch (err) { console.error('[Audit] channelCreate:', err.message); }
    });

    client.on('channelDelete', async (channel) => {
      if (!channel || !channel.guild) return;
      try {
        logActivity(channel.guild.id, {
          user: 'System',
          action: 'Channel Deleted',
          reason: `Channel #${channel.name} was deleted`
        });
      } catch (err) { console.error('[Audit] channelDelete:', err.message); }
    });

    // ── Roles ────────────────────────────────────────────────────────────
    client.on('roleCreate', async (role) => {
      if (!role || !role.guild) return;
      try {
        logActivity(role.guild.id, {
          user: 'System',
          action: 'Role Created',
          reason: `Role @${role.name} was created`
        });
      } catch (err) { console.error('[Audit] roleCreate:', err.message); }
    });

    client.on('roleDelete', async (role) => {
      if (!role || !role.guild) return;
      try {
        logActivity(role.guild.id, {
          user: 'System',
          action: 'Role Deleted',
          reason: `Role @${role.name} was deleted`
        });
      } catch (err) { console.error('[Audit] roleDelete:', err.message); }
    });

    console.log('✅ Audit Logger (dashboard logs) registered.');
  },
};
