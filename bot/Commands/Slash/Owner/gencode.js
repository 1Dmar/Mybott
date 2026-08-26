const { ApplicationCommandType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'gencode',
  description: 'Explain the server-side billing path',
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Owner',
  type: ApplicationCommandType.ChatInput,
  type1: 'slash',
  run: async (_client, interaction) => interaction.reply({
    embeds: [new EmbedBuilder().setColor('Blurple').setTitle('Legacy premium codes disabled').setDescription('Paid access is now determined by the centralized subscription authority after provider webhook verification. Use `/premium` or the Dashboard Premium Center; this command does not mint credentials or activate a plan.')],
    ephemeral: true,
  }),
};
