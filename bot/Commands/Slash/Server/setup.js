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
    const destination = guildId ? `${baseUrl}/myservers/${guildId}/intelligence` : `${baseUrl}/intelligence`;
    return interaction.reply({
      content: `ابدأ إعداد السيرفر من لوحة ProMcBot: ${destination}\n\n1) اضغط Generate one-time config.\n2) ثبّت JAR داخل Paper ثم الصق config.yml الناتج في plugins/ProMcBot/config.yml.\n3) أعد تشغيل Paper ونفّذ /promcbot status.\n4) ارجع للوحة وانتظر Heartbeat وTelemetry.\n\nIP وport اختياريان للمعلومة الأساسية فقط؛ بيانات اللاعبين والأوامر عن بُعد تحتاج Minecraft plugin.`,
      ephemeral: true,
    });
  },
};
