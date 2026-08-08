const { ApplicationCommandType, PermissionFlagsBits } = require("discord.js");
const Server = require('../../../Models/Server');
const StatusBar = require('../../../Models/StatusBar');
const { updateServerStatus } = require('../../../utils/statusUpdater');
module.exports = {
  name: "statusbar-setup",
  description: "Setup server status bar",
  userPermissions: PermissionFlagsBits.ManageGuild,
  category: "StatusBar",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "channel",
      description: "Target channel",
      type: 7,
      required: true
    },
    {
      name: "template",
      description: "Choose card design template",
      type: 3,
      required: false,
      choices: [
        { name: "Neon (Recommended)", value: "neon" },
        { name: "Dark Mode", value: "darkmode" },
        { name: "Glass", value: "glass" }
      ]
    },
    {
      name: "auto_wallpaper",
      description: "Automatically change wallpaper every minute",
      type: 5,
      required: false
    }
  ],
  run: async (client, interaction) => {
    const serverId = interaction.member.guild.id;
    const t = (key, fallback) => {
      const value = client.t(serverId, key);
      return value && value !== key ? value : fallback;
    };
    const channel = interaction.options.getChannel("channel");
    const template = interaction.options.getString("template") || "neon";
    const autoWallpaper = interaction.options.getBoolean("auto_wallpaper") ?? true;

    try {
      const server = await Server.findOne({ serverId });
      if (!server) {
        return interaction.reply({ 
          content: `❌ ${t("SERVER_NOT_FOUND", "Server not found in database!")}`, 
          ephemeral: true 
        });
      }

      let settings = await StatusBar.findOne({ serverId });
      if (!settings) settings = new StatusBar({ serverId });

      settings.statusChannelId = channel.id;
      settings.cardTemplate = template;
      settings.autoWallpaper = autoWallpaper;
      settings.updateInterval = 1; // Force 1 minute for live updates
      await settings.save();

      await interaction.reply({ 
        content: `⏳ ${t("STATUSBAR_SETUP_INIT", "Initializing live status bar in")} ${channel}...`,
        ephemeral: true 
      });

      await updateServerStatus(client, server, settings);

      await interaction.editReply({ 
        content:
          `✅ ${t("STATUSBAR_SETUP_SUCCESS", "Status bar setup complete in")} ${channel.toString()}\n` +
          `${t("TEMPLATE_LABEL", "Template")}: **${template}**\n` +
          `${t("AUTO_WALLPAPER_LABEL", "Auto Wallpaper")}: **${autoWallpaper ? t("ENABLED", "Enabled") : t("DISABLED", "Disabled")}**\n` +
          `${t("UPDATE_FREQUENCY_LABEL", "Update Frequency")}: **${t("EVERY_ONE_MINUTE", "Every 1 Minute")}**`,
      });
    } catch (error) {
      console.error(error);
      interaction.reply({ 
        content: `❌ ${t("STATUSBAR_SETUP_FAILED", "Setup failed!")}`, 
        ephemeral: true 
      });
    }
  }
};
