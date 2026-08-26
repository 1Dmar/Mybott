const { ApplicationCommandType, PermissionFlagsBits } = require('discord.js');
const Subscription = require('../../../Models/Subscription');
const { recordAudit } = require('../../../utils/auditLogService');

module.exports = {
  name: 'delmembership',
  description: 'Revoke local premium access for a guild',
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Owner',
  type: ApplicationCommandType.ChatInput,
  type1: 'slash',
  options: [{ name: 'serverid', description: 'The guild ID', type: 3, required: true }],
  run: async (_client, interaction) => {
    const owners = String(process.env.OWNER_ID || '').split(',').map(value => value.trim()).filter(Boolean);
    if (!owners.includes(interaction.user.id)) return interaction.reply({ content: 'Owner permission is required.', ephemeral: true });
    const serverId = interaction.options.getString('serverid');
    if (!serverId) return interaction.reply({ content: 'Please provide a server ID.', ephemeral: true });
    const updated = await Subscription.findOneAndUpdate({ guildId: serverId }, { $set: { plan: 'free', status: 'expired', provider: 'manual', renewalState: 'not_applicable', gracePeriodEnd: null } }, { new: true });
    await recordAudit({ actorId: interaction.user.id, guildId: serverId, action: 'premium_access_revoked', feature: 'billing.subscription', result: updated ? 'success' : 'failure', source: 'discord_owner_command', target: serverId });
    return interaction.reply({ content: updated ? `Local premium access revoked for guild \`${serverId}\`. Provider billing must be cancelled separately if applicable.` : `No centralized subscription was found for guild \`${serverId}\`.`, ephemeral: true });
  },
};
