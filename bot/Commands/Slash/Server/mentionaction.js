const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const Mentions = require("../../../Models/Mentions");
const fs = require('fs');
const path = require('path');
const tsPath = path.join(__dirname, "..", "..", "..", "public", "json", "translations.json"); 
const Langs = require("../../../Models/Langs");
const Server = require("../../../Models/User");

const translations = JSON.parse(fs.readFileSync(tsPath, 'utf8'));

async function getTranslatedMessage(guildId, messageKey) {
  const userLang = await Langs.findOne({ guildId });
  const language = userLang ? userLang.language : 'en';

  return translations[language][messageKey];
}

module.exports = {
  name: "setmention",
  description: `Set mention action for announcements`,
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Server",
    type1: "slash",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "mention",
      description: "Choose mention type: everyone, here, or nothing",
      type: 3,
      required: true,
      choices: [
        { name: "everyone", value: "everyone" },
        { name: "here", value: "here" },
        { name: "nothing", value: "nothing" },
      ],
    },
  ],
  run: async (client, interaction) => {
    const mention = interaction.options.getString("mention");
    const guildId = interaction.guild.id;
    const Mentiondone = await getTranslatedMessage(interaction.guild.id, 'Mentiondone');
const membershipServer = await Server.findOne({ Id: guildId });
    await Mentions.findOneAndUpdate(
      { guildId },
      { mention },
      { upsert: true }
    );

    interaction.reply({
      content: `${Mentiondone} ${mention}`,
      ephemeral: true,
    });

    const targetRoom = await client.channels.fetch('1273517280747065427');
    if (!targetRoom) return console.error('Invalid target room ID!');

    const embed = new EmbedBuilder()
        .setColor(0xcce5ff)
        .setTitle(`New server mention settings has been saved from ${interaction.guild.name}`)
        .addFields(
            { name: 'Server Id', value: `( ${interaction.guild.id} )`, inline: true },
            { name: 'Mention', value: `( ${mention} )`, inline: true },
            { name: 'By', value: `${interaction.user.username}`, inline: false },
            { name: 'isMemberShip?', value: `${membershipServer.ismembership ? "Yes" : "No"} (Plan ${membershipServer.plan})`, inline: false },
        )
        .setTimestamp();

    await targetRoom.send({ embeds: [embed] });
  },
};
