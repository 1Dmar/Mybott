const {
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { getServerInfo } = require('../../../utils/minecraftApi');

const C = { PRIMARY: 0x7C3AED, ERROR: 0xEF4444 };

function formatUptime(seconds) {
  if (!seconds) return 'N/A';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '< 1m';
}

module.exports = {
  name: 'mc-info',
  description: 'عرض معلومات سيرفر الماين كرافت',
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Minecraft',
  type1: 'slash',
  type: ApplicationCommandType.ChatInput,
  run: async (client, interaction) => {
    await interaction.deferReply();
    const guildId = interaction.guild.id;

    try {
      const data = await getServerInfo(guildId);
      const online  = data.onlinePlayers ?? '?';
      const max     = data.maxPlayers ?? '?';
      const motd    = data.motd || data.description || data.serverName || 'Minecraft Server';
      const version = data.version || 'Unknown';

      const fillBar = (max !== '?' && max > 0)
        ? (() => {
            const pct = Math.min(1, online / max);
            const filled = Math.round(pct * 10);
            return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${Math.round(pct * 100)}%`;
          })()
        : 'N/A';

      const embed = new EmbedBuilder()
        .setColor(C.PRIMARY)
        .setTitle('🏰 معلومات السيرفر')
        .setDescription(`> *${motd}*`)
        .addFields(
          { name: '👥 اللاعبون',      value: `\`${online}/${max}\``,              inline: true },
          { name: '🎮 الإصدار',       value: `\`${version}\``,                    inline: true },
          { name: '⏳ وقت التشغيل',   value: `\`${formatUptime(data.uptimeSeconds || data.uptime)}\``, inline: true },
          { name: '📈 نسبة الإشغال',  value: `\`${fillBar}\``,                   inline: false },
          ...(data.gameMode   ? [{ name: '🗡️ وضع اللعب', value: `\`${data.gameMode}\``,   inline: true }] : []),
          ...(data.difficulty ? [{ name: '⚔️ الصعوبة',   value: `\`${data.difficulty}\``, inline: true }] : []),
          ...(data.whitelistEnabled !== undefined ? [{ name: '📋 القائمة البيضاء', value: data.whitelistEnabled ? '`مفعَّلة`' : '`معطَّلة`', inline: true }] : []),
        )
        .setFooter({ text: `طُلب بواسطة ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const errEmbed = new EmbedBuilder()
        .setColor(C.ERROR)
        .setTitle('❌ خطأ')
        .setDescription(
          err.message === 'NO_MC_CONFIG'
            ? '⚠️ لم يتم ربط سيرفر ماين كرافت بعد! استخدم `/mc-setup` أولاً.'
            : `❌ خطأ: \`${err.message}\``
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [errEmbed] });
    }
  },
};
