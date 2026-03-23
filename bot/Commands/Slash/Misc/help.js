const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
  Client,
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
    
    const embed = new EmbedBuilder()
      .setColor("#2B2D31")
      .setAuthor({ name: client.t(guildId, "HELP_TITLE"), iconURL: client.user.displayAvatarURL() })
      .setTitle(client.t(guildId, "HELP_SUBTITLE"))
      .setURL("https://discord.com/oauth2/authorize?client_id=1220005260857311294&permissions=537250992&integration_type=0&scope=bot+applications.commands")
      .setDescription(client.t(guildId, "HELP_DESC"))
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: client.t(guildId, "HELP_FOOTER"), iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
