const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
  Client,
} = require("discord.js");

module.exports = {
  name: "ping",
  description: "عرض سرعة استجابة البوت",
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Misc",
  type1: "slash",
  type: ApplicationCommandType.ChatInput,
  /**
   *
   * @param {Client} client
   * @param {CommandInteraction} interaction
   */
  run: async (client, interaction) => {
    const emoji = client.emojis;
    const guildId = interaction.guild?.id;
    const wsPing = Math.max(0, Math.round(client.ws.ping));
    const apiPing = Math.max(0, Date.now() - interaction.createdTimestamp);

    const formatDuration = (ms) => {
      if (!ms || Number.isNaN(ms)) return "0s";
      const totalSeconds = Math.floor(ms / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const parts = [];
      if (days) parts.push(`${days}d`);
      if (hours) parts.push(`${hours}h`);
      if (minutes) parts.push(`${minutes}m`);
      if (!parts.length) parts.push(`${seconds}s`);
      return parts.join(" ");
    };

    let color = "#28d07f";
    let statusKey = "PING_STATUS_EXCELLENT";
    if (wsPing > 160) {
      color = "#ffc54d";
      statusKey = "PING_STATUS_GOOD";
    }
    if (wsPing > 260) {
      color = "#ff914d";
      statusKey = "PING_STATUS_STABLE";
    }
    if (wsPing > 420) {
      color = "#ff5d5d";
      statusKey = "PING_STATUS_POOR";
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: client.t(guildId, "PING_TITLE"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(client.t(guildId, "PING_SUBTITLE"))
      .addFields(
        {
          name: `${emoji.ROCKET || "🚀"} ${client.t(guildId, "PING_WEBSOCKET")}`,
          value: `\`${wsPing}ms\``,
          inline: true,
        },
        {
          name: `${emoji.LINK || "🔗"} ${client.t(guildId, "PING_API")}`,
          value: `\`${apiPing}ms\``,
          inline: true,
        },
        {
          name: `${emoji.GEAR || "⚙️"} ${client.t(guildId, "PING_UPTIME")}`,
          value: `\`${formatDuration(client.uptime)}\``,
          inline: true,
        },
        {
          name: `${emoji.SUCCESS || "✅"} ${client.t(guildId, "PING_STATUS")}`,
          value: `**${client.t(guildId, statusKey)}**`,
          inline: true,
        }
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
