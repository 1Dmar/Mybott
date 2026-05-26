const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
  Client,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = {
  name: "invite",
  description: "الحصول على رابط دعوة البوت",
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
    
    const embed = new EmbedBuilder()
      .setColor("#2B2D31")
      .setAuthor({ name: "Invite ProMcBot", iconURL: client.user.displayAvatarURL() })
      .setTitle("Expand Your Community with ProMcBot")
      .setDescription(`Bring the best Minecraft integration to your server! Click the buttons below to get started.`)
      .addFields(
        { name: `${emoji.LINK || "🔗"} Invite Link`, value: `[Click Here to Invite](https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot+applications.commands)`, inline: true },
        { name: `${emoji.INFO || "ℹ️"} Support`, value: `[Join Support Server](https://discord.gg/6FjFYStz5a)`, inline: true }
      )
      .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: "Thank you for choosing ProMcBot!", iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Invite Now")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot+applications.commands`)
        .setEmoji(emoji.ROCKET || "🚀"),
      new ButtonBuilder()
        .setLabel("Support Server")
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.gg/6FjFYStz5a")
        .setEmoji(emoji.LINK || "🔗")
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },
};
