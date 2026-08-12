const {
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
  ApplicationCommandOptionType,
} = require('discord.js');
const MinecraftConfig = require('../../../Models/MinecraftConfig');
const axios = require('axios');

const C = { PRIMARY: 0x7C3AED, GOLD: 0xF59E0B, SUCCESS: 0x10B981, ERROR: 0xEF4444 };

module.exports = {
  name: 'mc-setup',
  description: 'ربط سيرفر الماين كرافت بالبوت عبر HTTP API',
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Minecraft',
  type1: 'slash',
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: 'api_url',
      description: 'رابط API البلوغن (مثال: http://your-server-ip:8080)',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'bearer_token',
      description: 'الـ Bearer Token من config.yml في البلوغن',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'premium_key',
      description: 'Premium Key (اختياري - إذا كان البلوغن يشترطه)',
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const apiUrl = interaction.options.getString('api_url').replace(/\/+$/, '');
    const bearerToken = interaction.options.getString('bearer_token');
    const premiumKey = interaction.options.getString('premium_key') || null;
    const guildId = interaction.guild.id;

    // Show connecting embed
    const testEmbed = new EmbedBuilder()
      .setColor(C.PRIMARY)
      .setTitle('⚙️ جارٍ الاتصال...')
      .setDescription('يتم التحقق من اتصال API الماين كرافت...')
      .setTimestamp();
    await interaction.editReply({ embeds: [testEmbed] });

    try {
      const headers = { 'Authorization': `Bearer ${bearerToken}` };
      if (premiumKey) headers['X-Premium-Key'] = premiumKey;

      const response = await axios.get(`${apiUrl}/info`, { headers, timeout: 8000 });
      if (!response.data || response.data.success === false) throw new Error('Invalid API response');

      // Save config per guild
      await MinecraftConfig.findOneAndUpdate(
        { guildId },
        { guildId, apiUrl, bearerToken, premiumKey, updatedAt: new Date() },
        { upsert: true, new: true }
      );

      const info = response.data;
      const successEmbed = new EmbedBuilder()
        .setColor(C.SUCCESS)
        .setTitle('👑 تم الربط بنجاح!')
        .setDescription('سيرفر الماين كرافت مرتبط الآن بهذا السيرفر!')
        .addFields(
          { name: '🌐 API URL', value: `\`${apiUrl}\``, inline: false },
          { name: '🎮 السيرفر', value: info.serverName || info.name || 'Minecraft Server', inline: true },
          { name: '👥 اللاعبين', value: `${info.onlinePlayers ?? '?'}/${info.maxPlayers ?? '?'}`, inline: true },
          { name: '🔑 Premium Key', value: premiumKey ? '✅ مُفعَّل' : '❌ غير مُفعَّل', inline: true },
        )
        .setFooter({ text: `تم الإعداد بواسطة ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (err) {
      const errEmbed = new EmbedBuilder()
        .setColor(C.ERROR)
        .setTitle('⚠️ فشل الاتصال')
        .setDescription(
          err.response?.status === 401 ? '❌ **Bearer Token خاطئ** — تحقق من `config.yml` في البلوغن' :
          err.response?.status === 403 ? '❌ **Premium Key مطلوب أو خاطئ**' :
          err.code === 'ECONNREFUSED' ? '❌ **تعذّر الاتصال بالسيرفر** — تأكد أن البلوغن شغّال والـ Port صحيح' :
          err.code === 'ETIMEDOUT' ? '❌ **انتهت مهلة الاتصال** — تأكد من الـ IP والـ Port' :
          `❌ خطأ: \`${err.message}\``
        )
        .addFields({ name: '🔧 الرابط المُدخَل', value: `\`${apiUrl}\``, inline: false })
        .setFooter({ text: 'استخدم /mc-setup مرة أخرى بعد التصحيح' })
        .setTimestamp();

      await interaction.editReply({ embeds: [errEmbed] });
    }
  },
};
