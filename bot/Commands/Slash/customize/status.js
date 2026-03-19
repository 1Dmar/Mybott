const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  Client,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");
const Server = require("../../../Models/Server");
const Mentions = require("../../../Models/Mentions");
const fs = require('fs');
const Langs = require("../../../Models/Langs");
const axios = require('axios');
const path = require('path');
const tsPath = path.join(__dirname, "..", "..", "..", "public", "json", "translations.json");
const translations = JSON.parse(fs.readFileSync(tsPath, 'utf8'));

async function getTranslatedMessage(guildId, messageKey) {
  const userLang = await Langs.findOne({ guildId });
  const language = userLang ? userLang.language : 'en';

  return translations[language][messageKey];
}

let interval;

module.exports = {
  name: "status",
  description: "Open, Close or Restart the server.",
  userPermissions: PermissionFlagsBits.ManageChannels,
  botPermissions: PermissionFlagsBits.ManageChannels,
  category: "customize",
  type1: "slash",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: 'status',
      type: 3,
      description: 'Type of status you want (online, offline, restart)',
      required: true,
      choices: [
        {
          name: 'Online',
          value: 'online'
        },
        {
          name: 'Offline',
          value: 'offline'
        },
          {
          name: 'Under Maintenance',
          value: 'undermaintenance'
        },
        {
          name: 'Restart',
          value: 'restart'
        }
      ]
    }
  ],
  run: async (client, interaction, args) => {
    const status = interaction.options.getString("status");
    const guild = interaction.guild;
    const Serverdb = await Server.findOne({ serverId: guild.id });
    let statusemoji;
    let statustest;

    if (!Serverdb) {
      const NOT_FOUND = await getTranslatedMessage(guild.id, "NOT_FOUND");
      return interaction.reply({
        content: `${NOT_FOUND}`,
        ephemeral: true,
      });
    }

    if (status === 'online') {
      statusemoji = '<:online:1243574630728335402>';
      statustest = 'Back Online';
    } else if (status === 'offline') {
      statusemoji = '<:offline:1243574596654075965>';
      statustest = 'Offline';
    } else if (status === 'undermaintenance') {
         statusemoji = '<:restart:1243857151747686462>';
      statustest = 'Under Maintenance';
    } else {
      statusemoji = '<:restart:1243857151747686462>';
      statustest = 'Restarting for a few minutes';
    }

    const mentionData = await Mentions.findOne({ guildId: guild.id });
    const mentionText = mentionData && mentionData.mention && mentionData.mention !== "nothing" ? `@${mentionData.mention}` : "";

    const java = await getTranslatedMessage(guild.id, "java");
    const bedrock = await getTranslatedMessage(guild.id, "bedrock");

    let serverMessage = "";
    if (Serverdb.serverType === "java" && Serverdb.javaIP && Serverdb.javaPort) {
      serverMessage = `<:promc_down:1243498861041942538> ${java} \`${Serverdb.javaIP}\`:\`${Serverdb.javaPort}\``;
    } else if (Serverdb.serverType === "bedrock" && Serverdb.bedrockIP && Serverdb.bedrockPort) {
      serverMessage = `<:promc_down:1243498861041942538> ${bedrock} \`${Serverdb.bedrockIP}\`:\`${Serverdb.bedrockPort}\``;
    } else if (Serverdb.serverType === "custom") {
      if (Serverdb.javaIP && Serverdb.javaPort) {
        serverMessage += `<:promc_down:1243498861041942538> ${java} \`${Serverdb.javaIP}\`:\`${Serverdb.javaPort}\`\n`;
      }
      if (Serverdb.bedrockIP && Serverdb.bedrockPort) {
        serverMessage += `<:promc_down:1243498861041942538> ${bedrock} \`${Serverdb.bedrockIP}\`:\`${Serverdb.bedrockPort}\``;
      }
    }

    if (!serverMessage) {
      const SERVER_INFO_MISSING = await getTranslatedMessage(guild.id, "NOT_FOUND");
      return interaction.reply({
        content: `${SERVER_INFO_MISSING}`,
        ephemeral: true,
      });
    }

    let allowedMentions = { parse: ['users', 'roles'] };
    if (mentionData && (mentionData.mention === 'everyone' || mentionData.mention === 'here')) {
      allowedMentions = { parse: ['users', 'roles', 'everyone'] };
    }

    interaction.channel.send({
      content: `**# ${statusemoji} | ${Serverdb.serverName} Server\n\n## Server is ${statustest} ${statusemoji}\n\n<:promc_middle:1243498873205424199>\n${serverMessage}\n\n** || ${mentionText} x For ${mentionData ? mentionData.mention : ''} ||`,
      allowedMentions: allowedMentions
    });

    const THANKS_MESSAGE = await getTranslatedMessage(guild.id, 'Thanks1');
    interaction.reply({
      content: `${THANKS_MESSAGE}`,
      ephemeral: true,
    });
  },
};
