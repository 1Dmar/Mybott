const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  Client,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require("discord.js");
const membership = require("../../../Models/User");
const Mentions = require("../../../Models/Mentions");
const fs = require('fs');
const path = require('path');
const Langs = require("../../../Models/Langs");

// Translation file path
const tsPath = path.join(__dirname, "..", "..", "..", "public", "json", "translations.json"); 
let translations = {};

try {
  translations = JSON.parse(fs.readFileSync(tsPath, 'utf8'));
} catch (error) {
  console.error('Error loading translations:', error);
}

// Custom emojis (same as in interactionCreate.js)
const EMOJIS = {
  BEDROCK: '<:Bedrock:1410147921676075038>',
  OFFLINE: '<:Offline:1410178629098278922>',
  ONLINE: '<:Online:1410178650070061096>',
  PLAYER: '<:Player:1410147631308603494>',
  INFORMATION: '<:Information:1410147645883678763>',
  ACHIEVEMENT: '<:Achievement:1410147661008605224>',
  CHECK: '<:Check:1410147529630289960>',
  JAVA: '<:Java:1410147547363934300>',
  WARNING: '<:Warning:1410147601281581118>',
  BLOCK: '<:Block:1410147617056362558>'
};

async function getTranslatedMessage(guildId, messageKey) {
  try {
    const userLang = await Langs.findOne({ guildId });
    const language = userLang ? userLang.language : 'en';
    return translations[language]?.[messageKey] || messageKey;
  } catch (error) {
    console.error('Error getting translation:', error);
    return messageKey;
  }
}

module.exports = {
  name: "setup_server",
  description: "Setup the Minecraft server information",
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Server",
  type: ApplicationCommandType.ChatInput,

  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   */
  run: async (client, interaction) => {
    try {
      const guild = interaction.guild;
      
      // Check if user has membership
      const membershipdb = await membership.findOne({ Id: interaction.user.id });
      const hasMembership = membershipdb && membershipdb.plan && membershipdb.plan !== 'free';
      
      const Serverplanchoose = await getTranslatedMessage(guild.id, 'Serverplanchoose') || "Please select your server type:";
      
      // Create server type options
      const serverOptions = [
        {
          label: "Java",
          value: "java",
          emoji: EMOJIS.JAVA
        },
        {
          label: "Bedrock",
          value: "bedrock",
          emoji: EMOJIS.BEDROCK
        }
      ];
      
      // Add custom option if user has membership
      if (hasMembership) {
        serverOptions.push({
          label: "Custom - ⭐ Membership",
          value: "custom",
          emoji: EMOJIS.ACHIEVEMENT
        });
      } else {
        serverOptions.push({
          label: "Custom - ⭐ Membership Required",
          value: "custom",
          emoji: EMOJIS.WARNING,
          disabled: true
        });
      }
      
      const serverTypeRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("serverType")
          .setPlaceholder("Select server type")
          .addOptions(serverOptions)
      );

      await interaction.reply({
        content: `${EMOJIS.INFORMATION} ${Serverplanchoose}`,
        components: [serverTypeRow],
        ephemeral: true,
      });
      
    } catch (error) {
      console.error('Error in setup_server command:', error);
      
      const errorMessage = await getTranslatedMessage(interaction.guild.id, "COMMAND_ERROR") || "There was an error executing this command.";
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: `${EMOJIS.WARNING} ${errorMessage}`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `${EMOJIS.WARNING} ${errorMessage}`,
          ephemeral: true
        });
      }
    }
  },
};