'use strict';

const { ApplicationCommandType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'server-setup',
  description: 'بدء إعداد ProMcBot لهذا السيرفر',
  userPermissions: PermissionFlagsBits.ManageGuild,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Server',
  type: ApplicationCommandType.ChatInput,
  type1: 'slash',
  run: async (_client, interaction) => {
    const baseUrl = process.env.PUBLIC_BASE_URL || 'https://promcbot.dev';
    const guildId = interaction.guild?.id;
    const destination = guildId ? `${baseUrl}/servers/${guildId}/intelligence` : `${baseUrl}/intelligence`;
    return interaction.reply({
      content: `ابدأ إعداد السيرفر من لوحة ProMcBot: ${destination}\n\nستظهر لك خطوات Discord وMinecraft وtelemetry والهدف التشغيلي في مكان واحد.`,
      ephemeral: true,
    });
  },
};
