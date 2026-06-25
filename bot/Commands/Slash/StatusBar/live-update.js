const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
} = require("discord.js");
const Server = require("../../../Models/Server");
const StatusBar = require("../../../Models/StatusBar");
const { updateLiveStatusCard } = require("../../../utils/liveStatusCardGenerator");

module.exports = {
  name: "live-update",
  description: "Manually update the live status card",
  userPermissions: PermissionFlagsBits.ManageChannels,
  botPermissions: PermissionFlagsBits.ManageChannels,
  category: "customize",
  type1: "slash",
  type: ApplicationCommandType.ChatInput,
  run: async (client, interaction, args) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;

      // Get server and status bar configuration
      const serverDb = await Server.findOne({ serverId: guild.id });
      const statusBar = await StatusBar.findOne({ serverId: guild.id });

      if (!serverDb) {
        return interaction.editReply({
          content: '❌ Server configuration not found.',
        });
      }

      if (!statusBar) {
        return interaction.editReply({
          content: '❌ Live status card not set up. Use `/live-setup` first.',
        });
      }

      // Update the status card
      await updateLiveStatusCard(client, serverDb, statusBar);

      await interaction.editReply({
        content: '✅ Live status card updated successfully!',
      });

    } catch (error) {
      console.error('Error in live-update command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while updating the status card.',
      });
    }
  },
};
