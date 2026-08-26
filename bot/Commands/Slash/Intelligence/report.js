const { ApplicationCommandType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getForGuild } = require('../../../utils/entitlementService');
const { generateWeeklyReport } = require('../../../utils/weeklyReportEngine');

module.exports = {
  name: 'report', description: 'Generate the current weekly intelligence report', userPermissions: PermissionFlagsBits.ManageGuild, botPermissions: PermissionFlagsBits.SendMessages, category: 'Intelligence', type: ApplicationCommandType.ChatInput,
  run: async (_client, interaction) => {
    await interaction.deferReply({ ephemeral: true });
    try {
      const entitlement = await getForGuild(interaction.guild.id);
      const saved = await generateWeeklyReport(interaction.guild.id, entitlement.plan);
      const report = saved.report;
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x7c3aed).setTitle('ProMcBot Weekly Intelligence').setDescription(report.message || 'Report generated from received telemetry.').addFields({ name: 'Players analyzed', value: String(report.playersAnalyzed), inline: true }, { name: 'Returning players', value: String(report.returningPlayers), inline: true }, { name: 'Top problem', value: report.topProblem || 'No measured top problem.', inline: true }, { name: 'Biggest opportunity', value: report.biggestOpportunity || 'No measured opportunity yet.', inline: false }, { name: 'Recommended action', value: report.recommendedAction || 'No executable action recommended.', inline: false }).setFooter({ text: `Plan: ${entitlement.name} · data-backed report` }).setTimestamp()] });
    } catch (error) { return interaction.editReply({ content: `Weekly report is temporarily unavailable: ${error.message}` }); }
  },
};
