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
    const channel = interaction.options.getChannel("channel");
    const template = interaction.options.getString("template") || "neon";
    const autoWallpaper = interaction.options.getBoolean("auto_wallpaper") ?? true;

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
      settings.cardTemplate = template;
      settings.autoWallpaper = autoWallpaper;
      settings.updateInterval = 1; // Force 1 minute for live updates
      await settings.save();

      await interaction.reply({ 
        content: `⏳ Initializing live status bar in ${channel}...`,
        ephemeral: true 
      });

      await updateServerStatus(client, server, settings);

      await interaction.editReply({ 
        content: CONFIG.MESSAGES.SETUP_SUCCESS(channel.toString()) + 
                 `\nTemplate: **${template}**\nAuto Wallpaper: **${autoWallpaper ? 'Enabled' : 'Disabled'}**\nUpdate Frequency: **Every 1 Minute**`,
      });
    } catch (error) {
      console.error(error);
      interaction.reply({ 
        content: `❌ Setup failed!`, 
        ephemeral: true 
      });
    }
  }
};
