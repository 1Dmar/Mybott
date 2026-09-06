const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  Client,
} = require('discord.js');
const { base, field, COLORS } = require('../../../utils/proMcBotUI');

module.exports = {
  name: 'ping',
  description: 'عرض سرعة استجابة البوت',
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Misc',
  type1: 'slash',
  type: ApplicationCommandType.ChatInput,
  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   */
  run: async (client, interaction) => {
    const wsPing = Math.max(0, Math.round(client.ws.ping));
    const apiPing = Math.max(0, Date.now() - interaction.createdTimestamp);
    const formatDuration = (ms) => {
      if (!ms || Number.isNaN(ms)) return '0s';
      const totalSeconds = Math.floor(ms / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const parts = [];
      if (days) parts.push(`${days}d`);
      if (hours) parts.push(`${hours}h`);
      if (minutes) parts.push(`${minutes}m`);
      if (!parts.length) parts.push(`${Math.floor(totalSeconds % 60)}s`);
      return parts.join(' ');
    };

    const state = wsPing <= 160 ? 'HEALTHY' : wsPing <= 260 ? 'DEGRADED' : 'HIGH LATENCY';
    const color = wsPing <= 160 ? COLORS.success : wsPing <= 260 ? COLORS.warning : COLORS.error;
    const embed = base({
      title: 'Runtime Telemetry',
      eyebrow: state,
      description: 'Live response measurements from the Discord runtime.',
      color,
      footer: `ProMcBot Runtime • Requested by ${interaction.user.tag}`,
    });
    embed.addFields(
      field('WebSocket', `${wsPing}ms`),
      field('API response', `${apiPing}ms`),
      field('Uptime', formatDuration(client.uptime)),
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
