const { ApplicationCommandType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { PLANS } = require('../../../utils/entitlements');

module.exports = {
  name: 'premium', description: 'View ProMcBot plans and premium center', userPermissions: PermissionFlagsBits.ManageGuild, botPermissions: PermissionFlagsBits.SendMessages, category: 'Intelligence', type: ApplicationCommandType.ChatInput,
  run: async (_client, interaction) => {
    await interaction.deferReply({ ephemeral: true });
    const baseUrl = process.env.PUBLIC_BASE_URL || process.env.CALLBACK_URL?.replace('/auth/discord/callback', '') || 'https://promcbot.dev';
    const description = Object.values(PLANS).map(plan => `**${plan.name}** — $${plan.priceUsdMonthly.toFixed(2)}/month\n${plan.promise}`).join('\n\n');
    const premiumUrl = `${baseUrl}/myservers/${encodeURIComponent(interaction.guild.id)}/premium`;
    return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('ProMcBot Premium').setDescription(description).addFields({ name: 'Premium center', value: premiumUrl }, { name: 'Billing truth', value: 'The server verifies payment-provider webhooks before changing access. No command can activate paid access by itself.' }).setTimestamp()] });
  },
};
