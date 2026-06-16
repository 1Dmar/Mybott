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
        { name: "Dark Mode", value: "darkmode" },
        { name: "Glass", value: "glass" }
      ]
    }
  ],
  run: async (client, interaction) => {
    const serverId = interaction.member.guild.id;
    const channel = interaction.options.getChannel("channel");
    const template = interaction.options.getString("template") || "darkmode";

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
      await settings.save();

      await updateServerStatus(client, server, settings);

      interaction.reply({ 
        content: CONFIG.MESSAGES.SETUP_SUCCESS(channel.toString()) + `\nTemplate set to: **${template}**`,
        ephemeral: true 
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
