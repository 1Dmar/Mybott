'use strict';

const { PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const ServerInfo = require('../../../Models/Server');
const { generateServerStatusImage, WALLPAPERS } = require('../../../events/interactionCreate');

module.exports = {
  name: 'card',
  description: 'إنشاء بطاقة حالة السيرفر باستخدام الخلفية المحفوظة',
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Utility',
  type1: 'slash',
  run: async (_client, interaction) => {
    if (!interaction.guild) {
      return interaction.reply({ content: 'هذا الأمر متاح داخل السيرفرات فقط.', ephemeral: true });
    }

    const serverInfo = await ServerInfo.findOne({ serverId: interaction.guild.id });
    if (!serverInfo) {
      return interaction.reply({
        content: 'لم يتم العثور على معلومات السيرفر. استخدم `/setup` أولًا.',
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      const wallpaper = serverInfo.wallpaper || WALLPAPERS[0];
      const imageBuffer = await generateServerStatusImage(serverInfo, wallpaper, interaction, false);
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: `${String(serverInfo.serverName || 'minecraft').replace(/[^a-zA-Z0-9]/g, '_')}_status.png`,
      });

      return interaction.editReply({
        content: '✅ **Server Status Image:**',
        files: [attachment],
      });
    } catch (error) {
      console.error('Error in /utility card:', error);
      return interaction.editReply({
        content: '❌ حدث خطأ أثناء إنشاء بطاقة حالة السيرفر.',
      });
    }
  },
};
