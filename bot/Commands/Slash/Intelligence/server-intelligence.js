const { ApplicationCommandType, PermissionFlagsBits } = require('discord.js');
const { intelligence, error } = require('../../../utils/proMcBotUI');
const { serverIntelligence } = require('../../../utils/discordIntelligence');

module.exports = {
  name: 'server-intelligence', description: 'Show evidence-backed server intelligence', userPermissions: PermissionFlagsBits.ManageGuild, botPermissions: PermissionFlagsBits.SendMessages, category: 'Intelligence', type: ApplicationCommandType.ChatInput,
  run: async (_client, interaction) => {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { summary } = await serverIntelligence(interaction.guild.id);
      return interaction.editReply({ embeds: [intelligence({ summary })] });
    } catch (caught) { return interaction.editReply({ embeds: [error({ title: 'Intelligence Unavailable', reason: 'Evidence-backed analysis could not be generated.', action: 'Keep telemetry active and try again later.', code: caught.code })] }); }
  },
};
