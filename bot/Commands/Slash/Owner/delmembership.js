const { CommandInteraction, ApplicationCommandType, PermissionFlagsBits, Client } = require("discord.js");
const Server = require("../../../Models/User");

module.exports = {
  name: "delmembership",
<<<<<<< HEAD
  description: "Remove Premium from server",
=======
  description: "Remove premium from server",
>>>>>>> copilot/update-bot-design-and-translation-system
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Owner",
  type: ApplicationCommandType.ChatInput,
  type1: "slash",
  options: [
    {
      name: 'serverid',
      description: 'The ID of the server to remove Premium from',
      type: 3, // String type
      required: true,
    }
  ],
  run: async (client, interaction, args) => {
    const serverId = interaction.options.getString('serverid');
    if (interaction.user.id !== "804999528129363998" && interaction.user.id !== "1071690719418396752") return;

    if (!serverId) {
      return interaction.reply({ content: `> Please provide a server ID`, ephemeral: true });
    }
    let data = client.userSettings.get(serverId);
    if (!data?.ismembership) {
      return interaction.reply({ content: `Server with ID \`${serverId}\` is not a Premium server`, ephemeral: true });
    } else {
      await Server.findOneAndRemove({ Id: serverId });
      await client.userSettings.delete(serverId);
      return interaction.reply({ content: `Premium removed from server with ID \`${serverId}\``, ephemeral: true });
    }
  },
};
