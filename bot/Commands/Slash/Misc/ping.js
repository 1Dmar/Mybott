const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
  Client,
} = require('discord.js');

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
    const emoji = client.emojis;
    const guildId = interaction.guild?.id;
    const wsPing  = Math.max(0, Math.round(client.ws.ping));
    const apiPing = Math.max(0, Date.now() - interaction.createdTimestamp);

    const formatDuration = (ms) => {
      if (!ms || Number.isNaN(ms)) return '0s';
      const totalSeconds = Math.floor(ms / 1000);
      const days    = Math.floor(totalSeconds / 86400);
      const hours   = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const parts = [];
      if (days)    parts.push(`${days}d`);
      if (hours)   parts.push(`${hours}h`);
      if (minutes) parts.push(`${minutes}m`);
      if (!parts.length) parts.push(`${Math.floor(totalSeconds % 60)}s`);
      return parts.join(' ');
    };

    // Color & status based on ping
    let color      = 0x10B981; // green
    let statusLabel = '🟢 ممتاز';
    let statusBar   = '██████████';
    if (wsPing > 160) { color = 0xF59E0B; statusLabel = '🟡 جيد';    statusBar = '███████░░░'; }
    if (wsPing > 260) { color = 0xF97316; statusLabel = '🟠 مقبول';  statusBar = '█████░░░░░'; }
    if (wsPing > 420) { color = 0xEF4444; statusLabel = '🔴 ضعيف';   statusBar = '███░░░░░░░'; }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: client.t(guildId, 'PING_TITLE') || '📡 استجابة البوت',
        iconURL: client.user.displayAvatarURL(),
      })
      .setTitle('⚡ نتائج Ping')
      .setDescription(`\`\`\`\n${statusBar}  ${statusLabel}\n\`\`\``)
      .addFields(
        { name: `${emoji.ROCKET || '🚀'} WebSocket`, value: `\`${wsPing}ms\``,              inline: true },
        { name: `${emoji.LINK   || '🔗'} API`,       value: `\`${apiPing}ms\``,             inline: true },
        { name: `${emoji.GEAR   || '⚙️'} Uptime`,    value: `\`${formatDuration(client.uptime)}\``, inline: true },
      )
      .setThumbnail(client.user.displayAvatarURL({ size: 128 }))
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
