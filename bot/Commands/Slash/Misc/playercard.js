const { ApplicationCommandType, PermissionFlagsBits, AttachmentBuilder } = require("discord.js");
const { generatePlayerCard } = require('../../../utils/playerCardGenerator');
const Player = require('../../../Models/Player');

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
    const ign = interaction.options.getString("ign").trim();
    const template = interaction.options.getString("template") || "darkmode";

    await interaction.deferReply();

    try {
      // Generate player card
      const imageBuffer = await generatePlayerCard(ign, template);
      
      if (!imageBuffer) {
        return interaction.editReply({
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

      await interaction.editReply({
        content: `**${ign}'s Player Card** (Template: ${template})`,
        files: [attachment]
      });
    } catch (error) {
      console.error('Player card error:', error);
      await interaction.editReply({
        content: `❌ Error generating player card: ${error.message}`
      });
    }
  }
};
