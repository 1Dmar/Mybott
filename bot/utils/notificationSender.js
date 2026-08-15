// ── Notification sender (used by dashboard + bot events) ─────────────────
// Sends Discord embed notifications via the dashboard bot client (client1).

const { EmbedBuilder } = require('discord.js');

function buildEmbed(data) {
  const embed = new EmbedBuilder();
  if (data.title) embed.setTitle(String(data.title).slice(0, 256));
  if (data.description) embed.setDescription(String(data.description).slice(0, 4096));
  if (data.color) {
    const c = String(data.color).replace('#', '');
    if (/^[0-9a-fA-F]{6}$/.test(c)) embed.setColor(parseInt(c, 16));
  }
  if (data.imageUrl) embed.setImage(data.imageUrl);
  if (data.footer) embed.setFooter({ text: String(data.footer).slice(0, 2048) });
  embed.setTimestamp();
  if (Array.isArray(data.fields)) {
    for (const f of data.fields) {
      if (f && f.value) embed.addFields({ name: String(f.name || '\u200b').slice(0, 256), value: String(f.value).slice(0, 1024), inline: !!f.inline });
    }
  }
  return embed;
}

async function sendNotificationEmbed(client, target, data) {
  // target: { type: 'user'|'channel', id }
  try {
    let channel;
    if (target.type === 'user') {
      const user = await client.users.fetch(target.id, { force: false }).catch(() => null);
      if (!user) return { ok: false, error: 'User not found' };
      channel = await user.createDM().catch(() => null);
      if (!channel) return { ok: false, error: 'DMs are closed for this user' };
    } else {
      channel = await client.channels.fetch(target.id).catch(() => null);
      if (!channel) return { ok: false, error: 'Channel not found' };
    }
    await channel.send({ embeds: [buildEmbed(data)] });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * Deliver one notification document to its targets.
 * Returns stats update { total, success, failed, lastError }.
 */
async function deliverNotification(client, doc, { maxGuilds = 500, maxMembers = 2000 } = {}) {
  const stats = { total: 0, success: 0, failed: 0, lastError: null };

  const add = (ok, err) => {
    stats.total++;
    if (ok) stats.success++; else { stats.failed++; if (err) stats.lastError = String(err).slice(0, 500); }
  };

  try {
    switch (doc.targetType) {
      case 'user': {
        if (!doc.targetUserId) { add(false, 'No target user'); break; }
        const r = await sendNotificationEmbed(client, { type: 'user', id: doc.targetUserId }, doc);
        add(r.ok, r.error);
        break;
      }
      case 'channel': {
        if (!doc.targetGuildId || !doc.targetChannelId) { add(false, 'No channel set'); break; }
        const r = await sendNotificationEmbed(client, { type: 'channel', id: doc.targetChannelId }, doc);
        add(r.ok, r.error);
        break;
      }
      case 'guild': {
        let guild = client.guilds.cache.get(doc.targetGuildId);
        if (!guild) {
          try {
            guild = await client.guilds.fetch(doc.targetGuildId);
          } catch (e) { add(false, 'Guild not found'); break; }
        }
        const channels = (await guild.channels.fetch({ cache: false }).catch(() => new Map())) || new Map();
        let defaultChannel = null;
        try {
          const me = guild.members?.me || (await guild.members.fetchMe().catch(() => null));
          if (me) {
            defaultChannel = Array.from(channels.values()).find(c => c.type === 0 && c.permissionsFor(me).has('SendMessages'));
          }
        } catch (e) {}
        if (!defaultChannel) defaultChannel = Array.from(channels.values()).find(c => c.type === 0);
        if (!defaultChannel) { add(false, 'No accessible channel in guild'); break; }
        const content = doc.targetRole ? `<@&${doc.targetRole}> ` : '@everyone ';
        await defaultChannel.send({ content: content.trim(), embeds: [buildEmbed(doc)] }).catch(() => {});
        add(true);
        break;
      }
      case 'broadcast': {
        const guilds = await client.guilds.fetch().then(g => g.map(x => x)).catch(() => client.guilds.cache.map(g => g));
        const targetRole = doc.targetRole || null;
        for (const guild of guilds.slice(0, maxGuilds)) {
          try {
            const channels = (await guild.channels.fetch({ cache: false }).catch(() => new Map())) || new Map();
            let ch = null;
            try {
              const me = guild.members?.me || (await guild.members.fetchMe().catch(() => null));
              if (me) {
                ch = Array.from(channels.values()).find(c => c.type === 0 && c.permissionsFor(me).has('SendMessages'));
              }
            } catch (e) {}
            if (!ch) ch = Array.from(channels.values()).find(c => c.type === 0);
            if (!ch) continue;
            const content = targetRole ? `<@&${targetRole}> ` : '@everyone ';
            await ch.send({ content: content.trim(), embeds: [buildEmbed(doc)] });
            add(true);
          } catch (e) {
            add(false, e.message);
          }
          if (stats.total >= maxMembers) break;
        }
        break;
      }
      case 'everyone': {
        // DM every registered dashboard user (Api model)
        let ApiModel;
        try { ApiModel = require('../Models/Api'); } catch (e) { add(false, 'Api model missing'); break; }
        const users = await ApiModel.find({}).select('discordId').lean().catch(() => []);
        for (const u of users.slice(0, maxMembers)) {
          if (!u.discordId) continue;
          const r = await sendNotificationEmbed(client, { type: 'user', id: u.discordId }, doc);
          add(r.ok, r.error);
        }
        break;
      }
    }
  } catch (err) {
    stats.failed++;
    stats.lastError = String(err.message || err).slice(0, 500);
  }
  return stats;
}

module.exports = { buildEmbed, sendNotificationEmbed, deliverNotification };
