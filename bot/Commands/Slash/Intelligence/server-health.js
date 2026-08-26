const { ApplicationCommandType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const PluginInstance = require('../../../Models/PluginInstance');
const TelemetryEvent = require('../../../Models/TelemetryEvent');

module.exports = {
  name: 'server-health', description: 'Show measured Minecraft connection health', userPermissions: PermissionFlagsBits.ManageGuild, botPermissions: PermissionFlagsBits.SendMessages, category: 'Intelligence', type: ApplicationCommandType.ChatInput,
  run: async (_client, interaction) => {
    await interaction.deferReply({ ephemeral: true });
    try {
      const [instance, count] = await Promise.all([PluginInstance.findOne({ serverId: interaction.guild.id }).sort({ lastSeenAt: -1 }).lean(), TelemetryEvent.findOne({ serverId: interaction.guild.id, type: 'player_count' }).sort({ occurredAt: -1 }).lean()]);
      const age = instance?.lastSeenAt ? Math.round((Date.now() - new Date(instance.lastSeenAt).getTime()) / 60000) : null;
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(instance && age !== null && age <= 5 ? 0x22c55e : 0xf59e0b).setTitle('ProMcBot Server Health').addFields({ name: 'Connection', value: instance ? (age !== null && age <= 5 ? 'Online' : 'Stale / needs review') : 'Not connected', inline: true }, { name: 'Instance', value: instance?.instanceId || '—', inline: true }, { name: 'Online players', value: count?.data?.onlinePlayers === undefined ? 'Not enough data yet.' : String(count.data.onlinePlayers), inline: true }, { name: 'Last heartbeat', value: instance?.lastSeenAt ? new Date(instance.lastSeenAt).toISOString() : 'Not enough data yet.' }).setFooter({ text: 'Health is based on plugin heartbeats and player-count telemetry.' }).setTimestamp()] });
    } catch (error) { return interaction.editReply({ content: `Server health is temporarily unavailable: ${error.message}` }); }
  },
};
