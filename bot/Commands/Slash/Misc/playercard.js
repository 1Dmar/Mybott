const { ApplicationCommandType, PermissionFlagsBits, AttachmentBuilder } = require("discord.js");
const { generatePlayerCard } = require('../../../utils/playerCardGenerator');
const Player = require('../../../Models/Player');
const Server = require('../../../Models/Server');

module.exports = {
  name: "playercard",
  description: "Show a player card with their Minecraft profile",
  userPermissions: PermissionFlagsBits.SendMessages,
  category: "Misc",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "ign",
      description: "Player's Minecraft username",
      type: 3,
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
    const guildId = interaction.guild?.id;
    const t = (key, fallback) => {
      const value = client.t(guildId, key);
      return value && value !== key ? value : fallback;
    };
    const ign = interaction.options.getString("ign").trim();
    const template = interaction.options.getString("template") || "darkmode";

    await interaction.deferReply();

    try {
      const serverConfig = await Server.findOne({ serverId: interaction.guild.id });
      
      // Generate player card
      const imageBuffer = await generatePlayerCard(ign, template, serverConfig, {
        labels: {
          notFound: t("PLAYER_NOT_FOUND", "Player not found"),
          level: t("PLAYER_LEVEL", "Level"),
          balance: t("PLAYER_BALANCE", "Balance"),
          server: t("SERVER_NAME_LABEL", "Server"),
          verified: t("VERIFIED", "VERIFIED"),
          online: t("ONLINE", "ONLINE"),
          offline: t("OFFLINE", "OFFLINE"),
          systemFooter: t("PROMCBOT_SYSTEM", "PROMCBOT SYSTEM"),
        }
      });
      
      if (!imageBuffer) {
        return interaction.editReply({
          content: `❌ ${t("PLAYER_CARD_GENERATE_FAILED", "Could not generate card for player")}: **${ign}**`
        });
      }

      const attachment = new AttachmentBuilder(imageBuffer, { name: `${ign}-card.png` });

      // Save to database
      try {
        await Player.findOneAndUpdate(
          { ign: ign.toLowerCase() },
          { 
            ign: ign.toLowerCase(),
            cardTemplate: template,
            updatedAt: new Date()
          },
          { upsert: true }
        );
      } catch (dbError) {
        console.error('Database error:', dbError);
      }

      await interaction.editReply({
        content: `**${ign}** • ${t("PLAYER_CARD_TITLE", "Player Card")} (${t("TEMPLATE_LABEL", "Template")}: ${template})`,
        files: [attachment]
      });
    } catch (error) {
      console.error('Player card error:', error);
      await interaction.editReply({
        content: `❌ ${t("PLAYER_CARD_ERROR", "Error generating player card")}: ${error.message}`
      });
    }
  }
};
