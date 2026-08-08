const { ApplicationCommandType } = require("discord.js");
const Server = require('../../../Models/Server');
const StatusBar = require('../../../Models/StatusBar');
const { updateServerStatus } = require('../../../utils/statusUpdater');

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
      const t = (key, fallback) => {
        const value = client.t(serverId, key);
        return value && value !== key ? value : fallback;
      };

    try {
      const server = await Server.findOne({ serverId });
      const settings = await StatusBar.findOne({ serverId });

      if (!server || !settings) {
        return interaction.reply({ 
          content: `${client.emojis.ERROR} ${t("STATUSBAR_NOT_CONFIGURED", "Server not configured!")}`, 
          ephemeral: true 
        });
      }

      await updateServerStatus(client, server, settings);
      interaction.reply({ 
        content: `✅ ${t("STATUSBAR_UPDATED", "Status bar updated successfully!")}`, 
        ephemeral: true 
      });
    } catch (error) {
      interaction.reply({ 
        content: `${client.emojis.ERROR} ${t("STATUSBAR_UPDATE_FAILED", "Update failed!")}`, 
        ephemeral: true 
      });
    }
  }
};