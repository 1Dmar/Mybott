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
    const ping = client.ws.ping;
    let color = "#43b581";
    if (ping > 200) color = "#faa61a";
    if (ping > 400) color = "#f04747";

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({ name: "Bot Latency", iconURL: client.user.displayAvatarURL() })
      .setDescription(`${emoji.UP || "📈"} **Latency:** \`${ping}ms\`\n${emoji.GEAR || "⚙️"} **Status:** ${ping < 150 ? "Excellent" : "Stable"}`)
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
