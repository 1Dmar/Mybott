const {
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const Langs = require("../../../Models/Langs");
const Server = require("../../../Models/User");

const LANGUAGE_CHOICES = [
  { name: "English (Default)", value: "en" },
  { name: "العربية", value: "ar" },
  { name: "Español", value: "es" },
  { name: "中文", value: "zh" },
];

const LANGUAGE_LABELS = {
  en: "English (Default)",
  ar: "العربية",
  es: "Español",
  zh: "中文",
};

module.exports = {
  name: "setlanguage",
  description: "Change the bot language for this server",
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Server",
  type1: "slash",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "language",
      description: "Choose your server language",
      type: 3,
      required: true,
      choices: LANGUAGE_CHOICES,
    },
  ],
  run: async (client, interaction) => {
    const language = interaction.options.getString("language");
    const guildId = interaction.guild?.id;

    if (!guildId) {
      return interaction.reply({
        content: client.t(guildId, "PROCESSING_ERROR"),
        ephemeral: true,
      });
    }

    const previousLang = await Langs.findOne({ guildIds: guildId }).lean();
    await Langs.findOneAndUpdate(
      { guildIds: guildId },
      { $set: { language } },
      { upsert: true, new: true }
    );

    client.languages.set(guildId, language);

    const langName = LANGUAGE_LABELS[language] || language;
    const languageSet = client.t(guildId, "Languageset");

    await interaction.reply({
      content: `${languageSet} ${langName}`,
      ephemeral: true,
    });

    const targetRoomId = '1273517280747065427';
    try {
      const targetRoom = await client.channels.fetch(targetRoomId);
      if (!targetRoom) return;

      const membershipServer = await Server.findOne({ Id: guildId });
      const prevLang = previousLang?.language || client.defaultLanguage;

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`New server language has been saved from ${interaction.guild.name}`)
        .addFields(
          { name: "Server Id", value: `( ${guildId} )`, inline: true },
          { name: "Language", value: `( ${prevLang} ) => ${langName} (${language})`, inline: true },
          { name: "By", value: `${interaction.user.username}`, inline: false },
          {
            name: "isMemberShip?",
            value: `${membershipServer?.ismembership ? "Yes" : "No"} (Plan ${membershipServer?.plan ?? "free"})`,
            inline: false,
          }
        )
        .setTimestamp();

      await targetRoom.send({ embeds: [embed] });
    } catch (error) {
      console.error("Failed to log language change:", error.message);
    }
  },
};
