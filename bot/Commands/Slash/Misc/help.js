const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
  Client,
} = require("discord.js");

module.exports = {
  name: "help",
  description: `Get Bot help panel !!`,
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
    // Code
    const embed = new EmbedBuilder()

            .setColor("#ee3c37")

            .setTitle(`ProMcBot | MineServers Assistant`)

        .setURL("https://discord.com/oauth2/authorize?client_id=1220005260857311294&permissions=537250992&integration_type=0&scope=bot+applications.commands")

            .setDescription("**ProMcBot provides an easy way to connect a Minecraft server to Discord. You can view and control server information at the push of a button.\n\nMain commands:\n\n/setup_server\nTo set up a Minecraft server by clicking server_Type from Dropdown.\n\n/remove_server\nto disable integration and remove data from the bot.\n\nFor support, contact [ProMcBot Support](https://discord.gg/6FjFYStz5a)\n**");

        

        await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
