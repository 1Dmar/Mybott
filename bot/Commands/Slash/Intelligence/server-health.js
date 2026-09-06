const { ApplicationCommandType, PermissionFlagsBits } = require('discord.js');
const { serverHealth, error } = require('../../../utils/proMcBotUI');
const PluginInstance = require('../../../Models/PluginInstance');
const TelemetryEvent = require('../../../Models/TelemetryEvent');

module.exports = {
  name: 'server-health', description: 'Show measured Minecraft connection health', userPermissions: PermissionFlagsBits.ManageGuild, botPermissions: PermissionFlagsBits.SendMessages, category: 'Intelligence', type: ApplicationCommandType.ChatInput,
  run: async (_client, interaction) => {
    await interaction.deferReply({ ephemeral: true });
    try {
      const [instance, count] = await Promise.all([PluginInstance.findOne({ serverId: interaction.guild.id }).sort({ lastSeenAt: -1 }).lean(), TelemetryEvent.findOne({ serverId: interaction.guild.id, type: 'player_count' }).sort({ occurredAt: -1 }).lean()]);
      const age = instance?.lastSeenAt ? Math.round((Date.now() - new Date(instance.lastSeenAt).getTime()) / 60000) : null;
      return interaction.editReply({ embeds: [serverHealth({ instance, playerCount: count })] });
    } catch (caught) { return interaction.editReply({ embeds: [error({ title: 'Server Health Unavailable', reason: 'Measured health data could not be retrieved.', action: 'Check the plugin heartbeat and try again.', code: caught.code })] }); }
  },
};
