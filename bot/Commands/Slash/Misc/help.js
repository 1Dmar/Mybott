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
  name: "help",
  description: "عرض قائمة المساعدة والأوامر المتاحة",
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
    const guildId = interaction.guild.id;
    const emoji = client.emojis;
    
    const embed = new EmbedBuilder()
      .setColor("#2B2D31")
      .setAuthor({ 
        name: client.t(guildId, "HELP_TITLE"), 
        iconURL: client.user.displayAvatarURL() 
      })
      .setTitle(client.t(guildId, "HELP_SUBTITLE"))
      .setDescription(client.t(guildId, "HELP_DESC"))
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setImage("https://i.ibb.co/TBVZycXV/2.png") // الفاصل الجمالي
      .setFooter({ 
        text: `Developed with ❤️ by 1Dmar • ${client.user.username}`, 
        iconURL: interaction.user.displayAvatarURL() 
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Support Server")
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.gg/6FjFYStz5a")
        .setEmoji(emoji.LINK || "🔗"),
      new ButtonBuilder()
        .setLabel("Invite Bot")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot+applications.commands`)
        .setEmoji(emoji.ROCKET || "🚀")
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },
};
