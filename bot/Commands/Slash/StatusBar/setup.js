const { ApplicationCommandType, PermissionFlagsBits } = require("discord.js");
const Server = require('../../../Models/Server');
const StatusBar = require('../../../Models/StatusBar');
const { updateServerStatus } = require('../../../utils/statusUpdater');
const CONFIG = require('../../../config');

module.exports = {
  name: "statusbar-setup",
  description: "Setup server status bar",
  userPermissions: PermissionFlagsBits.ManageGuild,
  category: "StatusBar",
  type: ApplicationCommandType.ChatInput,
  options: [
   /* {
      name: "server",
      description: "Server ID",
      type: 3,
      required: true
    },*/
    {
      name: "channel",
      description: "Target channel",
      type: 7,
      required: true
    }
  ],
  run: async (client, interaction) => {
  //  const serverId = interaction.options.getString("server");
      const serverId = interaction.member.guild.id;
    const channel = interaction.options.getChannel("channel");

    try {
      const server = await Server.findOne({ serverId });
      if (!server) {
        return interaction.reply({ 
          content: CONFIG.MESSAGES.SERVER_NOT_FOUND, 
          ephemeral: true 
        });
      }

      let settings = await StatusBar.findOne({ serverId });
      if (!settings) settings = new StatusBar({ serverId });
      
      settings.statusChannelId = channel.id;
      await settings.save();

      await updateServerStatus(client, server, settings);
      
      interaction.reply({ 
        content: CONFIG.MESSAGES.SETUP_SUCCESS(channel.toString()),
        ephemeral: true 
      });
    } catch (error) {
      interaction.reply({ 
        content: '❌ Setup failed!', 
        ephemeral: true 
      });
    }
  }
};