const { ApplicationCommandType } = require("discord.js");
const Server = require('../../../Models/Server');
const StatusBar = require('../../../Models/StatusBar');
const { updateServerStatus } = require('../../../utils/statusUpdater');
const CONFIG = require('../../../config');

module.exports = {
  name: "statusbar-update",
  description: "Manually update status bar",
  category: "StatusBar",
  type: ApplicationCommandType.ChatInput,
  options: [
   /* {
      name: "server",
      description: "Server ID",
      type: 3,
      required: true
    }*/
  ],
  run: async (client, interaction) => {
  //  const serverId = interaction.options.getString("server");
      const serverId = interaction.member.guild.id;

    try {
      const server = await Server.findOne({ serverId });
      const settings = await StatusBar.findOne({ serverId });

      if (!server || !settings) {
        return interaction.reply({ 
          content: '❌ Server not configured!', 
          ephemeral: true 
        });
      }

      await updateServerStatus(client, server, settings);
      interaction.reply({ 
        content: CONFIG.MESSAGES.UPDATE_SUCCESS, 
        ephemeral: true 
      });
    } catch (error) {
      interaction.reply({ 
        content: '❌ Update failed!', 
        ephemeral: true 
      });
    }
  }
};