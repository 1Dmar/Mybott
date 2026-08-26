const { ApplicationCommandType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { playerIntelligence } = require('../../../utils/discordIntelligence');
const { getForGuild } = require('../../../utils/entitlementService');
const { hasFeature } = require('../../../utils/entitlements');

module.exports = {
  name: 'retention', description: 'Show advanced player retention analysis', userPermissions: PermissionFlagsBits.ManageGuild, botPermissions: PermissionFlagsBits.SendMessages, category: 'Intelligence', type: ApplicationCommandType.ChatInput,
  run: async (_client, interaction) => {
    await interaction.deferReply({ ephemeral: true });
    try {
      const entitlement = await getForGuild(interaction.guild.id);
      if (!hasFeature(entitlement, 'retention.advanced')) return interaction.editReply({ content: 'This intelligence report requires Pro. ProMcBot already exposes basic player activity; open the premium center to unlock retention cohorts and return behavior.' });
      const { summary } = await playerIntelligence(interaction.guild.id, entitlement.historyDays);
      const r = summary.retention;
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('ProMcBot Retention').setDescription(summary.message || 'Retention calculated from real player telemetry.').addFields({ name: 'New players (7d)', value: String(r.newPlayers7d), inline: true }, { name: 'Returned within 7d', value: String(r.returnedWithinSevenDays), inline: true }, { name: 'Return rate', value: r.returnRate === null ? 'Not enough data yet.' : `${r.returnRate}%`, inline: true }, { name: '7-day cohort retention', value: r.sevenDayRetention === null ? 'Not enough data yet.' : `${r.sevenDayRetention}%`, inline: true }).setFooter({ text: 'Evidence window: ' + entitlement.historyDays + ' days.' }).setTimestamp()] });
    } catch (error) { return interaction.editReply({ content: `Retention analysis is temporarily unavailable: ${error.message}` }); }
  },
};
