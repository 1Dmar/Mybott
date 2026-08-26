const { ApplicationCommandType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { serverIntelligence } = require('../../../utils/discordIntelligence');
const AutomationExecution = require('../../../Models/AutomationExecution');

module.exports = {
  name: 'actions', description: 'Show the ProMcBot action center', userPermissions: PermissionFlagsBits.ManageGuild, botPermissions: PermissionFlagsBits.SendMessages, category: 'Intelligence', type: ApplicationCommandType.ChatInput,
  run: async (_client, interaction) => {
    await interaction.deferReply({ ephemeral: true });
    try {
      const [{ summary }, executions] = await Promise.all([serverIntelligence(interaction.guild.id), AutomationExecution.find({ serverId: interaction.guild.id }).sort({ executedAt: -1 }).limit(5).lean()]);
      const recommendations = summary.recommendations || [];
      const text = recommendations.length ? recommendations.slice(0, 5).map((item, index) => `${index + 1}. **${item.what}**\n${item.why}\n_Action: recommendation only until an automation is configured._`).join('\n\n') : 'No evidence-backed action is required right now.';
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('ProMcBot Action Center').setDescription(text).addFields({ name: 'Recent automation executions', value: executions.length ? executions.map(item => `${item.status}: ${item.trigger}`).join('\n') : 'No automation executions recorded.' }).setFooter({ text: 'Every executable action must have a configured rule and audit record.' }).setTimestamp()] });
    } catch (error) { return interaction.editReply({ content: `Action Center is temporarily unavailable: ${error.message}` }); }
  },
};
