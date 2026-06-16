const { AttachmentBuilder, PermissionFlagsBits } = require("discord.js");
const { generatePlayerCard } = require('../../../utils/playerCardGenerator');
const Player = require('../../../Models/Player');

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
    if (args.length === 0) {
      return message.reply({
        content: `❌ **Usage:** \`${prefix}playercard <IGN> [template]\`\n> **Templates:** \`darkmode\` or \`glass\``
      });
    }

    const ign = args[0].trim();
    const template = args[1]?.toLowerCase() === 'glass' ? 'glass' : 'darkmode';

    const loadingMsg = await message.reply({
      content: "⏳ Generating player card..."
    });

    try {
      // Generate player card
      const imageBuffer = await generatePlayerCard(ign, template);
      
      if (!imageBuffer) {
        return loadingMsg.edit({
          content: `❌ Could not generate card for player: **${ign}**`
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
        content: `**${ign}'s Player Card** (Template: ${template})`,
        files: [attachment]
      });
    } catch (error) {
      console.error('Player card error:', error);
      await loadingMsg.edit({
        content: `❌ Error generating player card: ${error.message}`
      });
    }
  }
};
