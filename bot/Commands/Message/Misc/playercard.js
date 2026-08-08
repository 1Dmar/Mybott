const { AttachmentBuilder, PermissionFlagsBits } = require("discord.js");
const { generatePlayerCard } = require('../../../utils/playerCardGenerator');
const Player = require('../../../Models/Player');
const Server = require('../../../Models/Server');

module.exports = {
  name: "playercard",
  description: "Show a player card with their Minecraft profile",
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Misc",
  cooldown: 5,
  type1: "message",
  membership: false,

  run: async (client, message, args, prefix) => {
    const guildId = message.guild?.id;
    const t = (key, fallback) => {
      const value = client.t(guildId, key);
      return value && value !== key ? value : fallback;
    };

    if (args.length === 0) {
      return message.reply({
        content: `❌ **${t("USAGE_LABEL", "Usage")}:** \`${prefix}playercard <IGN> [template]\`\n> **${t("TEMPLATE_LABEL", "Template")}s:** \`darkmode\` or \`glass\``
      });
    }

    const ign = args[0].trim();
    const template = args[1]?.toLowerCase() === 'glass' ? 'glass' : 'darkmode';

    const loadingMsg = await message.reply({
      content: `⏳ ${t("GENERATING_PLAYER_CARD", "Generating player card")}...`
    });

    try {
      const serverConfig = guildId ? await Server.findOne({ serverId: guildId }) : null;

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
        return loadingMsg.edit({
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

      await loadingMsg.edit({
        content: `**${ign}** • ${t("PLAYER_CARD_TITLE", "Player Card")} (${t("TEMPLATE_LABEL", "Template")}: ${template})`,
        files: [attachment]
      });
    } catch (error) {
      console.error('Player card error:', error);
      await loadingMsg.edit({
        content: `❌ ${t("PLAYER_CARD_ERROR", "Error generating player card")}: ${error.message}`
      });
    }
  }
};
