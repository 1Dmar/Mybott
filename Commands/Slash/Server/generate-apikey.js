const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const ApiKey = require('../../../Models/apiKey');
const db = require('pro.db');

function generateApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  return key;
}

module.exports = {
  name: 'generate-apikey',
  description: 'توليد API Key للسيرفر',
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Server',
  type1: 'slash',
  type: ApplicationCommandType.ChatInput,
  /**
   * @param {CommandInteraction} interaction
   */
  run: async (client, interaction) => {
    if (!interaction.guild) {
      return interaction.reply({ content: 'هذا الأمر يعمل داخل السيرفرات فقط.', ephemeral: true });
    }
    const guildId = interaction.guild.id;
    const authCode = generateApiKey();

    try {
      let apiKey = await ApiKey.findOne({ guildId });
      if (apiKey) {
        apiKey.authCode = authCode;
      } else {
        apiKey = new ApiKey({ guildId, authCode });
      }
      await apiKey.save();
      db.set(guildId, authCode, { ttl: 43200 }); // 12 hours

      // DM the key
      const dmEmbed = new EmbedBuilder()
        .setColor(0x7C3AED)
        .setTitle('🔑 API Key الخاص بك')
        .setDescription('> **احتفظ بهذا المفتاح في مكان آمن ولا تشاركه مع أحد!**')
        .addFields(
          { name: '🗝️ المفتاح', value: `\`\`\`\npromc.${authCode}\n\`\`\``, inline: false },
          { name: '⏳ الصلاحية', value: '`12 ساعة`', inline: true },
          { name: '📌 الاستخدام', value: 'استخدم `/link-apikey` لربطه بالسيرفر', inline: true },
        )
        .setFooter({ text: client.user.username, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      try {
        await interaction.user.send({ embeds: [dmEmbed] });
      } catch {
        // DMs closed - ignore
      }

      const replyEmbed = new EmbedBuilder()
        .setColor(0x10B981)
        .setTitle('✅ تم توليد API Key')
        .setDescription('تم إرسال المفتاح إلى رسائلك الخاصة!')
        .addFields({
          name: '⚠️ ملاحظة',
          value: 'إذا لم تصلك الرسالة، تأكد أن رسائلك الخاصة مفتوحة.',
          inline: false,
        })
        .setFooter({ text: `طُلب بواسطة ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      await interaction.reply({ embeds: [replyEmbed], ephemeral: true });
    } catch (err) {
      console.error('Error generating API key:', err);
      const errEmbed = new EmbedBuilder()
        .setColor(0xEF4444)
        .setTitle('❌ خطأ')
        .setDescription('حدث خطأ أثناء توليد المفتاح. حاول مرة أخرى.')
        .setTimestamp();
      await interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  },
};
