const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  Client,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const membership = require("../../../Models/User");
const Mentions = require("../../../Models/Mentions");
const fs = require('fs');
const path = require('path');
const Langs = require("../../../Models/Langs");
const tsPath = path.join(__dirname, "..", "..", "..", "public", "json", "translations.json"); 
const translations = JSON.parse(fs.readFileSync(tsPath, 'utf8'));

async function getTranslatedMessage(guildId, messageKey) {
  const userLang = await Langs.findOne({ guildId });
  const language = userLang ? userLang.language : 'en';

  return translations[language][messageKey];
}

module.exports = {
  name: "setup_server",
  description: `Setup the Minecraft server information`,
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Server",
    type1: "slash",
  type: ApplicationCommandType.ChatInput,

  run: async (client, interaction) => {
    let serverTypeRow;
    const guild = interaction.guild;

    const membershipdb = await membership.findOne({ Id: guild.id });
    const Serverplanchoose = await getTranslatedMessage(guild.id, 'Serverplanchoose')
      serverTypeRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("serverType")
          .setPlaceholder("Select server type")
          .addOptions([
            {
              label: "Java",
              value: "java",
            },
            {
              label: "Bedrock",
              value: "bedrock",
            },
            {
              label: "Custom - ⭐ MemberShip",
              value: "custom",
              disabled: true,
            },
          ])
      );
    

    await interaction.reply({
      content: `${Serverplanchoose}`,
      components: [serverTypeRow],
      ephemeral: true,
    });
  },
};
