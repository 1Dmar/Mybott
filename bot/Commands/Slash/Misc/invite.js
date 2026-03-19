const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
  Client,
} = require("discord.js");

module.exports = {
  name: "invite",
  description: `Get the bot invite link.`,
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
    await interaction.reply({ content: "Thank you for using our bot! 🙌\nInvite the bot to your server: [Invite Link](https://discord.com/oauth2/authorize?client_id=1220005260857311294&permissions=537250992&integration_type=0&scope=bot+applications.commands)\nNeed help? Join our support server: [Support Server](https://discord.gg/6FjFYStz5a) ", ephemeral: true });
  },
};
