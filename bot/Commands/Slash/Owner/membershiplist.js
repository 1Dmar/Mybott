const { ApplicationCommandType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Subscription = require('../../../Models/Subscription');
const { getEntitlement, PLAN_ORDER } = require('../../../utils/entitlements');

module.exports = {
  name: 'mslist', description: 'Show centralized paid subscriptions', userPermissions: PermissionFlagsBits.Administrator, botPermissions: PermissionFlagsBits.SendMessages, category: 'Owner', type: ApplicationCommandType.ChatInput, type1: 'slash',
  run: async (_client, interaction) => {
    const owners = String(process.env.OWNER_ID || '').split(',').map(value => value.trim()).filter(Boolean);
    if (!owners.includes(interaction.user.id)) return interaction.reply({ content: 'Owner permission is required.', ephemeral: true });
    const subscriptions = await Subscription.find({ plan: { $in: ['pro', 'ultimate'] } }).sort({ createdAt: -1 }).lean();
    const active = subscriptions.map(subscription => ({ subscription, entitlement: getEntitlement(subscription) })).filter(item => PLAN_ORDER.indexOf(item.entitlement.plan) > 0);
    const description = active.length ? active.map(({ subscription, entitlement }) => `Guild: \`${subscription.guildId}\` · **${entitlement.name}** · ${entitlement.status} · ends ${entitlement.currentPeriodEnd ? `<t:${Math.floor(new Date(entitlement.currentPeriodEnd).getTime() / 1000)}:F>` : 'not set'}`).join('\n') : 'No active paid subscription found.';
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('Blurple').setTitle('Centralized paid subscriptions').setDescription(description).setFooter({ text: 'Source: Subscription authority' })], ephemeral: true });
  },
};
