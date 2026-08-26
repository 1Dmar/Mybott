const { ApplicationCommandType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { playerIntelligence } = require('../../../utils/discordIntelligence');

module.exports = {
  name: 'player-insights', description: 'Show measured player journey insights', userPermissions: PermissionFlagsBits.ManageGuild, botPermissions: PermissionFlagsBits.SendMessages, category: 'Intelligence', type: ApplicationCommandType.ChatInput,
  run: async (_client, interaction) => {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { summary } = await playerIntelligence(interaction.guild.id);
      const journey = Object.entries(summary.journey || {}).map(([key, value]) => `${key}: ${value}`).join(' · ') || 'Not enough data yet.';
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('ProMcBot Player Insights').setDescription(summary.message || 'Player lifecycle calculated from join/leave telemetry.').addFields({ name: 'Journey', value: journey }, { name: 'Players observed', value: String(summary.sample?.players ?? 0), inline: true }, { name: 'Return rate (7d)', value: summary.retention?.returnRate === null ? 'Not enough data yet.' : `${summary.retention.returnRate}%`, inline: true }, { name: 'Evidence confidence', value: summary.confidence || 'insufficient', inline: true }).setFooter({ text: 'No player analytics are generated without observed events.' }).setTimestamp()] });
    } catch (error) { return interaction.editReply({ content: `Player insights are temporarily unavailable: ${error.message}` }); }
  },
};
