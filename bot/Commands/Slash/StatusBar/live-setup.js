const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  Client,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const Server = require("../../../Models/Server");
const StatusBar = require("../../../Models/StatusBar");
const { updateLiveStatusCard } = require("../../../utils/liveStatusCardGenerator");

module.exports = {
  name: "live-setup",
  description: "Setup a live status card for your Minecraft server",
  userPermissions: PermissionFlagsBits.ManageChannels,
  botPermissions: PermissionFlagsBits.ManageChannels,
  category: "customize",
  type1: "slash",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: 'channel',
      type: 7, // Channel type
      description: 'The channel where the live status card will be posted',
      required: true,
      channel_types: [ChannelType.GuildText]
    },
    {
      name: 'template',
      type: 3,
      description: 'Card design template',
      required: false,
      choices: [
        {
          name: 'Neon (Recommended)',
          value: 'neon'
        },
        {
          name: 'Glass',
          value: 'glass'
        },
        {
          name: 'Dark Mode',
          value: 'darkmode'
        }
      ]
    },
    {
      name: 'auto_wallpaper',
      type: 5, // Boolean
      description: 'Enable automatic wallpaper rotation',
      required: false
    },
    {
      name: 'update_interval',
      type: 4, // Integer
      description: 'Update interval in minutes (1-60)',
      required: false,
      min_value: 1,
      max_value: 60
    }
  ],
  run: async (client, interaction, args) => {
    try {
      await interaction.deferReply();

      const guild = interaction.guild;
      const channel = interaction.options.getChannel('channel');
      const template = interaction.options.getString('template') || 'neon';
      const autoWallpaper = interaction.options.getBoolean('auto_wallpaper') !== false;
      const updateInterval = interaction.options.getInteger('update_interval') || 1;

      // Get server configuration
      const serverDb = await Server.findOne({ serverId: guild.id });
      if (!serverDb || !serverDb.javaIP && !serverDb.bedrockIP) {
        return interaction.editReply({
          content: '❌ Server configuration not found. Please set up your server first using `/server-setup`',
          ephemeral: true,
        });
      }

      // Create or update StatusBar settings
      let statusBar = await StatusBar.findOne({ serverId: guild.id });
      
      if (!statusBar) {
        statusBar = new StatusBar({
          serverId: guild.id,
          statusChannelId: channel.id,
          cardTemplate: template,
          autoWallpaper: autoWallpaper,
          updateInterval: updateInterval,
        });
      } else {
        statusBar.statusChannelId = channel.id;
        statusBar.cardTemplate = template;
        statusBar.autoWallpaper = autoWallpaper;
        statusBar.updateInterval = updateInterval;
      }

      await statusBar.save();

      // Generate initial status card
      try {
        await updateLiveStatusCard(client, serverDb, statusBar);
      } catch (error) {
        console.error('Error generating initial status card:', error);
      }

      // Send success message with options
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('refresh_status_card')
            .setLabel('🔄 Refresh Now')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('stop_status_card')
            .setLabel('⏹️ Stop')
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.editReply({
        content: `✅ **Live Status Card Setup Complete!**\n\n` +
                `📍 **Channel:** ${channel}\n` +
                `🎨 **Template:** ${template}\n` +
                `🔄 **Auto Wallpaper:** ${autoWallpaper ? 'Enabled' : 'Disabled'}\n` +
                `⏱️ **Update Interval:** Every ${updateInterval} minute(s)\n\n` +
                `The live status card will now update automatically!`,
        components: [row]
      });

    } catch (error) {
      console.error('Error in live-setup command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while setting up the live status card.',
        ephemeral: true,
      });
    }
  },
};
