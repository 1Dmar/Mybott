const {
  ApplicationCommandType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const Server = require("../../../Models/Server");
const fs = require('fs');
const path = require('path');
const tsPath = path.join(__dirname, "..", "..", "..", "public", "json", "translations.json"); 
const Langs = require("../../../Models/Langs");

const translations = JSON.parse(fs.readFileSync(tsPath, 'utf8'));

async function getTranslatedMessage(guildId, messageKey) {
  const userLang = await Langs.findOne({ guildId });
  const language = userLang ? userLang.language : 'en';

  return translations[language][messageKey];
}

module.exports = {
  name: "remove_server",
  description: `Remove the Minecraft server information`,
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Server",
    type1: "slash",
  type: ApplicationCommandType.ChatInput,

  run: async (client, interaction) => {
    const guild = interaction.guild;

    const NOT_FOUND = await getTranslatedMessage(guild.id, 'NOT_FOUND');
    const serverId = guild.id;

    const serverRecord = await Server.findOne({ serverId });

    if (!serverRecord) {
      return interaction.reply({ content: `${NOT_FOUND}`, ephemeral: true });
    }

    const CANCEL_LABEL = await getTranslatedMessage(guild.id, 'CANCEL');
    const CONTINUE_LABEL = await getTranslatedMessage(guild.id, 'CONTINUE');

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('cancel')
                .setLabel(CANCEL_LABEL)
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('continue')
                .setLabel(CONTINUE_LABEL)
                .setStyle(ButtonStyle.Success)
        );

    const SURE_MESSAGE = await getTranslatedMessage(guild.id, 'SURE_MESSAGE');
    const confirmMessage = await interaction.reply({
        content: `${SURE_MESSAGE}`,
        components: [row],
        ephemeral: true
    });

    const filter = i => i.user.id === interaction.user.id;

    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

    const CANCEL_MESSAGE = await getTranslatedMessage(guild.id, 'CANCEL_MESSAGE');
    const CONTINUE_MESSAGE = await getTranslatedMessage(guild.id, 'CONTINUE_MESSAGE');

    collector.on('collect', async i => {
        if (i.customId === 'cancel') {
            await i.update({ content: `${CANCEL_MESSAGE}`, components: [], ephemeral: true });
        } else if (i.customId === 'continue') {
            await Server.deleteOne({ serverId });
            await i.update({ content: `${CONTINUE_MESSAGE}`, components: [], ephemeral: true });
        }
    });

    const TIME_END_MESSAGE = await getTranslatedMessage(guild.id, 'TIME_END_MESSAGE');
    collector.on('end', collected => {
        if (collected.size === 0) {
            interaction.editReply({ content: `${TIME_END_MESSAGE}`, components: [], ephemeral: true });
        }
    });

  },
};
