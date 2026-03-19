const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  Client,
  EmbedBuilder,
} = require("discord.js");
const Server = require("../../../Models/Server");
const Mentions = require("../../../Models/Mentions");
const fs = require('fs');
const Langs = require("../../../Models/Langs");
const path = require('path');
const tsPath = path.join(__dirname, "..", "..", "..", "public", "json", "translations.json");
const translations = JSON.parse(fs.readFileSync(tsPath, 'utf8'));

async function getTranslatedMessage(guildId, messageKey) {
  const userLang = await Langs.findOne({ guildId });
  const language = userLang ? userLang.language : 'en';

  return translations[language][messageKey];
}

module.exports = {
  name: "keyall",
  description: `Get Avatar of a User !!`,
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "customize",
  type1: "slash",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "game",
      description: `Example: Boxpvp, Survival, Crystalpvp...etc`,
      type: 3,
      required: true,
    },
    {
      name: "amount",
      description: `Amount of Members to Koth !!`,
      type: 4,
      required: true,
    }
  ],
  run: async (client, interaction, args) => {
    const amount = interaction.options.getInteger("amount");
    const game = interaction.options.getString("game");
    const guild = interaction.guild;

    const Serverdb = await Server.findOne({ serverId: guild.id });

    if (!Serverdb) {
      const NOT_FOUND = await getTranslatedMessage(guild.id, 'NOT_FOUND');
      return interaction.reply({
        content: `${NOT_FOUND}`,
        ephemeral: true,
      });
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
      const NOT_FOUND = await getTranslatedMessage(guild.id, 'NOT_FOUND');
      return interaction.reply({
        content: `${NOT_FOUND}`,
        ephemeral: true,
      });
    }

    const KEY_ALL = await getTranslatedMessage(guild.id, 'KEY_ALL');
    const player = await getTranslatedMessage(guild.id, 'player');

     let allowedMentions = { parse: ['users', 'roles'] };
    if (mentionData && mentionData.mention === 'everyone') {
      allowedMentions = { parse: ['users', 'roles', 'everyone'] };
    }

    interaction.channel.send({
      content: `**# <:Announce:1358119642329124914> | ${KEY_ALL} ${game}\n\n## ${amount} ${player}\n\n<:promc_middle:1243498873205424199>\n${serverMessage}\n\n** || ${mentionText} x For ${mentionData ? mentionData.mention : ''} ||`,
      allowedMentions: allowedMentions
    });

    const THANKS_MESSAGE = await getTranslatedMessage(guild.id, 'Thanks1');
    interaction.reply({
      content: `${THANKS_MESSAGE}`,
      ephemeral: true,
    });
  },
};