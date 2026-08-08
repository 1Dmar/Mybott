const { ApplicationCommandType, PermissionFlagsBits } = require("discord.js");
const StatusBar = require('../../../Models/StatusBar');
const CONFIG = require('../../../config');

module.exports = {
  name: "statusbar-interval",
  description: "Change update interval",
  userPermissions: PermissionFlagsBits.ManageGuild,
  category: "StatusBar",
  type: ApplicationCommandType.ChatInput,
  options: [
    /*{
      name: "server",
      description: "Server ID",
      type: 3,
      required: true
    },*/
    {
      name: "minutes",
      description: "Update interval in minutes",
      type: 4,
      required: true,
      min_value: CONFIG.MIN_UPDATE_INTERVAL,
      max_value: CONFIG.MAX_UPDATE_INTERVAL
    }
  ],
  run: async (client, interaction) => {
  //  const serverId = interaction.options.getString("server");
      const serverId = interaction.member.guild.id;
    const t = (key, fallback) => {
      const value = client.t(serverId, key);
      return value && value !== key ? value : fallback;
    };
    const minutes = interaction.options.getInteger("minutes");

    try {
      let settings = await StatusBar.findOne({ serverId });
      if (!settings) settings = new StatusBar({ serverId });
      
      settings.updateInterval = minutes;
      await settings.save();
      
      interaction.reply({ 
        content: `✅ ${t("STATUSBAR_INTERVAL_UPDATED", "Update interval set to")} ${minutes} ${t("MINUTES_LABEL", "minutes")}!`, 
        ephemeral: true 
      });
    } catch (error) {
      interaction.reply({ 
        content: `${client.emojis.ERROR} ${t("STATUSBAR_INTERVAL_FAILED", "Interval update failed!")}`, 
        ephemeral: true 
      });
    }
  }
};