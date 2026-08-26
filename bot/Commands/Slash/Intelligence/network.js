const { ApplicationCommandType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getForGuild } = require('../../../utils/entitlementService');
const { hasFeature } = require('../../../utils/entitlements');
const { networkIntelligence } = require('../../../utils/discordIntelligence');

module.exports = {
  name: 'network', description: 'Show Ultimate network intelligence', userPermissions: PermissionFlagsBits.ManageGuild, botPermissions: PermissionFlagsBits.SendMessages, category: 'Intelligence', type: ApplicationCommandType.ChatInput,
  run: async (_client, interaction) => {
    await interaction.deferReply({ ephemeral: true });
    try {
      const entitlement = await getForGuild(interaction.guild.id);
      if (!hasFeature(entitlement, 'network.intelligence')) return interaction.editReply({ content: 'Network intelligence requires Ultimate. ProMcBot can still show server-level health and player insights on your current plan.' });
      const report = await networkIntelligence(interaction.guild.id);
      const servers = report.servers?.length ? report.servers.slice(0, 10).map(server => `${server.serverName}: ${server.averageOnlinePlayers === null ? 'not enough data' : `${server.averageOnlinePlayers} avg players`}`).join('\n') : 'Not enough data yet.';
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x8b5cf6).setTitle('ProMcBot Network Intelligence').setDescription(report.message || `Network health: ${report.networkHealth ?? 'not measurable'}/100`).addFields({ name: 'Measured servers', value: `${report.measuredServerCount}/${report.serverCount}`, inline: true }, { name: 'Top-performing server', value: report.topPerformingServer?.serverName || 'Not enough data yet.', inline: true }, { name: 'Weakest-performing server', value: report.weakestPerformingServer?.serverName || 'Not enough data yet.', inline: true }, { name: 'Server comparison', value: servers }).setTimestamp()] });
    } catch (error) { return interaction.editReply({ content: `Network intelligence is temporarily unavailable: ${error.message}` }); }
  },
};
