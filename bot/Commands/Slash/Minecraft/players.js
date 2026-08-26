'use strict';

const { ApplicationCommandType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const TelemetryEvent = require('../../../Models/TelemetryEvent');

function displayName(value) {
  return String(value || 'Unknown').replace(/[\\`*_~|]/g, '\\$&').slice(0, 32);
}

module.exports = {
  name: 'minecraft-players',
  description: 'عرض اللاعبين الذين أمكن قياس جلساتهم من telemetry',
  userPermissions: PermissionFlagsBits.ManageGuild,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Minecraft',
  type: ApplicationCommandType.ChatInput,
  type1: 'slash',
  run: async (_client, interaction) => {
    await interaction.deferReply({ ephemeral: true });
    try {
      const events = await TelemetryEvent.find({
        serverId: interaction.guild.id,
        type: { $in: ['player_join', 'player_leave'] },
        occurredAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }).sort({ occurredAt: 1 }).limit(10000).lean();
      const latest = new Map();
      for (const event of events) {
        const username = event.data?.username;
        if (username) latest.set(String(username).toLowerCase(), { username: String(username), type: event.type, occurredAt: event.occurredAt });
      }
      const online = [...latest.values()].filter(event => event.type === 'player_join');
      const description = online.length
        ? online.slice(0, 30).map((event, index) => `\`${String(index + 1).padStart(2, '0')}\` **${displayName(event.username)}**`).join('\n')
        : 'لا توجد جلسات لاعبين نشطة يمكن إثباتها من telemetry خلال آخر 24 ساعة.';
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(online.length ? 0x22c55e : 0x64748b).setTitle('Measured Minecraft players').setDescription(description).addFields({ name: 'Measured active sessions', value: String(online.length), inline: true }, { name: 'Window', value: 'Last 24 hours', inline: true }).setFooter({ text: 'القائمة مبنية على آخر join/leave مسجل، وليست تخمينًا لحظيًا.' }).setTimestamp()] });
    } catch (error) {
      return interaction.editReply({ content: 'تعذر قراءة player telemetry حاليًا. تحقق من اتصال MongoDB والplugin.' });
    }
  },
};
