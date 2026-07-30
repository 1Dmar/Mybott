const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const ApiKey = require('../../../Models/apiKey');
const db = require('pro.db');

module.exports = {
  name: 'link-apikey',
  description: 'ربط API Key بالسيرفر',
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Server',
  type1: 'slash',
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: 'apikey',
      description: 'الـ API Key (تبدأ بـ promc.)',
      type: 3,
      required: true,
    },
  ],
  /**
   * @param {CommandInteraction} interaction
   */
  run: async (client, interaction) => {
    const apiKey = interaction.options.getString('apikey');

    if (!interaction.guild) {
      return interaction.reply({ content: 'هذا الأمر يعمل داخل السيرفرات فقط.', ephemeral: true });
    }

    if (!apiKey || !apiKey.startsWith('promc.')) {
      const errEmbed = new EmbedBuilder()
        .setColor(0xEF4444)
        .setTitle('❌ مفتاح غير صحيح')
        .setDescription('يجب أن يبدأ المفتاح بـ `promc.` — استخدم `/generate-apikey` أولاً.')
        .setTimestamp();
      return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }

    const authCode = apiKey.split('promc.')[1];
    const guildId = interaction.guild.id;
    const storedApiKey = await db.get(guildId);

    if (!storedApiKey || storedApiKey !== authCode) {
      const errEmbed = new EmbedBuilder()
        .setColor(0xEF4444)
        .setTitle('❌ مفتاح منتهي الصلاحية أو خاطئ')
        .setDescription('المفتاح غير صحيح أو انتهت صلاحيته (12 ساعة). استخدم `/generate-apikey` للحصول على مفتاح جديد.')
        .setTimestamp();
      return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }

    try {
      let apiKeyRecord = await ApiKey.findOne({ guildId });
      if (apiKeyRecord) {
        apiKeyRecord.authCode = authCode;
      } else {
        apiKeyRecord = new ApiKey({ guildId, authCode });
      }
      await apiKeyRecord.save();
      db.delete(guildId);

      const successEmbed = new EmbedBuilder()
        .setColor(0x10B981)
        .setTitle('👑 تم الربط بنجاح!')
        .setDescription('API Key مرتبط بهذا السيرفر بنجاح.')
        .addFields(
          { name: '🔑 المفتاح', value: `\`promc.${authCode.substring(0, 8)}...\``, inline: true },
          { name: '✅ الحالة',  value: '`مُفعَّل`',                                inline: true },
        )
        .setFooter({ text: `ربطه ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    } catch (err) {
      console.error('Error linking API key:', err);
      const errEmbed = new EmbedBuilder()
        .setColor(0xEF4444)
        .setTitle('❌ خطأ')
        .setDescription('حدث خطأ أثناء ربط المفتاح. حاول مرة أخرى.')
        .setTimestamp();
      await interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  },
};
