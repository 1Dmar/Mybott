const { ApplicationCommandType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { serverIntelligence } = require('../../../utils/discordIntelligence');

module.exports = {
  name: 'server-intelligence', description: 'Show evidence-backed server intelligence', userPermissions: PermissionFlagsBits.ManageGuild, botPermissions: PermissionFlagsBits.SendMessages, category: 'Intelligence', type: ApplicationCommandType.ChatInput,
  run: async (_client, interaction) => {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { summary } = await serverIntelligence(interaction.guild.id);
      const fields = [{ name: 'Observed events', value: String(summary.sample?.events ?? 0), inline: true }, { name: 'Confidence', value: summary.confidence || 'insufficient', inline: true }, { name: 'Analysis', value: summary.analysis?.length ? summary.analysis.slice(0, 3).map(item => `${item.label}: ${item.changePercent === null ? 'not measurable' : `${item.changePercent}%`}`).join('\n') : 'Not enough data yet.' }];
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('ProMcBot Server Intelligence').setDescription(summary.message || 'Evidence-backed server observations from telemetry.').addFields(fields).setFooter({ text: 'Numbers are calculated from received telemetry.' }).setTimestamp()] });
    } catch (error) { return interaction.editReply({ content: `Server intelligence is temporarily unavailable: ${error.message}` }); }
  },
};
