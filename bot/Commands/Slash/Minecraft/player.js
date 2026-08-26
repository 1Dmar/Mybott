'use strict';

const { ApplicationCommandType, PermissionFlagsBits, ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const TelemetryEvent = require('../../../Models/TelemetryEvent');

module.exports = {
  name: 'minecraft-player',
  description: 'عرض آخر نشاط مقاس للاعب من telemetry',
  userPermissions: PermissionFlagsBits.ManageGuild,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Minecraft',
  type: ApplicationCommandType.ChatInput,
  type1: 'slash',
  options: [{ name: 'username', description: 'اسم لاعب Minecraft', type: ApplicationCommandOptionType.String, required: true }],
  run: async (_client, interaction) => {
    const username = interaction.options.getString('username', true).trim().slice(0, 32);
    await interaction.deferReply({ ephemeral: true });
    try {
      const events = await TelemetryEvent.find({
        serverId: interaction.guild.id,
        type: { $in: ['player_join', 'player_leave'] },
        'data.username': { $regex: `^${username.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, $options: 'i' },
      }).sort({ occurredAt: -1 }).limit(20).lean();
      const latest = events[0];
      if (!latest) return interaction.editReply({ content: `لا توجد telemetry مسجلة للاعب **${username}**.` });
      const lastSeen = latest.occurredAt ? new Date(latest.occurredAt).toISOString() : '—';
      const status = latest.type === 'player_join' ? 'آخر حالة مقاسة: متصل' : 'آخر حالة مقاسة: غادر';
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(latest.type === 'player_join' ? 0x22c55e : 0x64748b).setTitle(`Measured player: ${username}`).addFields({ name: 'Status', value: status, inline: true }, { name: 'Last measured event', value: lastSeen, inline: true }).setFooter({ text: 'المصدر: Minecraft plugin telemetry فقط.' }).setTimestamp()] });
    } catch (error) {
      return interaction.editReply({ content: 'تعذر قراءة player telemetry حاليًا. تحقق من اتصال MongoDB والplugin.' });
    }
  },
};
