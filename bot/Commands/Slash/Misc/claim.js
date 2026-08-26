const { ApplicationCommandType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'claim',
  description: 'Open the ProMcBot premium center',
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Misc',
  type: ApplicationCommandType.ChatInput,
  run: async (_client, interaction) => {
    await interaction.deferReply({ ephemeral: true });
    const baseUrl = process.env.PUBLIC_BASE_URL || process.env.CALLBACK_URL?.replace('/auth/discord/callback', '') || 'https://promcbot.dev';
    return interaction.editReply({
      content: `Premium is now managed by the server-side subscription authority.\n\nOpen the premium center: ${baseUrl}/premium\n\nLegacy premium-key claims are disabled so the Dashboard, API, Bot, Plugin, and automations use one entitlement source.`,
    });
  },
};
