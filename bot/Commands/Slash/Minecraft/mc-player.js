const {
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
  ApplicationCommandOptionType,
} = require('discord.js');
const { getPlayer } = require('../../../utils/minecraftApi');

const C = { PRIMARY: 0x7C3AED, SUCCESS: 0x10B981, ERROR: 0xEF4444, OFFLINE: 0x6B7280 };

function formatPlaytime(seconds) {
  if (!seconds) return '0s';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || !parts.length) parts.push(`${s}s`);
  return parts.join(' ');
}

module.exports = {
  name: 'mc-player',
  description: 'عرض معلومات لاعب على سيرفر الماين كرافت',
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Minecraft',
  type1: 'slash',
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: 'username',
      description: 'اسم اللاعب في الماين كرافت',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  run: async (client, interaction) => {
    await interaction.deferReply();
    const username = interaction.options.getString('username').trim();
    const guildId = interaction.guild.id;

    try {
      const data = await getPlayer(guildId, username);
      const isOnline = data.isOnline;
      const color = isOnline ? C.SUCCESS : C.OFFLINE;
      const statusIcon = isOnline ? '🟢' : '⚫';
      const skinUrl = `https://mc-heads.net/avatar/${data.uuid || username}/64`;
      const bodyUrl = `https://mc-heads.net/body/${data.uuid || username}`;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: `${statusIcon} ${data.username || username}`, iconURL: skinUrl })
        .setTitle('👑 بطاقة اللاعب')
        .setThumbnail(skinUrl)
        .addFields(
          { name: '📊 الحالة',        value: isOnline ? '`🟢 متصل`'               : '`⚫ غير متصل`',           inline: true },
          { name: '🌍 العالم',         value: isOnline ? `\`${data.world || 'N/A'}\`` : '`—`',                   inline: true },
          { name: '📡 Ping',           value: isOnline ? `\`${data.ping ?? 0}ms\``   : '`—`',                   inline: true },
          { name: '🪪 UUID',           value: `\`${(data.uuid || 'N/A').substring(0, 18)}...\``,                 inline: false },
          { name: '⏱️ وقت اللعب الكلي', value: `\`${data.formattedPlaytime || formatPlaytime(data.totalPlaytimeSeconds)}\``, inline: true },
          { name: '⌚ الجلسة الحالية', value: `\`${formatPlaytime(data.sessionPlaytimeSeconds)}\``,              inline: true },
          { name: '🔑 نوع الحساب',     value: `\`${data.accountType || 'UNKNOWN'}\``,                           inline: true },
        )
        .setImage(bodyUrl)
        .setFooter({ text: `طُلب بواسطة ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      if (data.isBanned) embed.addFields({ name: '🔨 محظور', value: '`نعم`', inline: true });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const errEmbed = new EmbedBuilder()
        .setColor(C.ERROR)
        .setTitle('❌ تعذّر جلب المعلومات')
        .setDescription(
          err.message === 'NO_MC_CONFIG'       ? '⚠️ لم يتم ربط سيرفر ماين كرافت بعد! استخدم `/mc-setup` أولاً.' :
          err.response?.status === 404         ? `❌ اللاعب \`${username}\` غير موجود في السيرفر.` :
          err.response?.status === 401         ? '❌ خطأ في المصادقة — استخدم `/mc-setup` لتحديث الإعدادات.' :
          `❌ خطأ: \`${err.message}\``
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [errEmbed] });
    }
  },
};
