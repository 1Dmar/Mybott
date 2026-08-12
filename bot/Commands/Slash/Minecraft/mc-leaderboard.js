const {
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { getLeaderboard } = require('../../../utils/minecraftApi');

const C = { GOLD: 0xF59E0B, ERROR: 0xEF4444 };
const MEDALS = ['🥇', '🥈', '🥉'];

function formatSeconds(s) {
  if (!s) return '0s';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '< 1m';
}

module.exports = {
  name: 'mc-leaderboard',
  description: 'عرض لوحة صدارة اللاعبين حسب وقت اللعب',
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Minecraft',
  type1: 'slash',
  type: ApplicationCommandType.ChatInput,
  run: async (client, interaction) => {
    await interaction.deferReply();
    const guildId = interaction.guild.id;

    try {
      const data = await getLeaderboard(guildId);
      const entries = data.leaderboard || data.players || data.entries || [];

      if (!entries.length) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(C.GOLD)
              .setTitle('🏆 لوحة الصدارة')
              .setDescription('*لا توجد بيانات بعد. العب أكثر!*')
              .setTimestamp()
          ]
        });
      }

      const top = entries.slice(0, 10);
      const description = top.map((entry, i) => {
        const medal  = MEDALS[i] || `\`${(i + 1).toString().padStart(2, '0')}\``;
        const name   = entry.username || entry.name || 'Unknown';
        const time   = formatSeconds(entry.totalPlaytimeSeconds || entry.playtime || 0);
        const online = entry.isOnline ? '🟢' : '⚫';
        return `${medal} ${online} **${name}** — \`${time}\``;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(C.GOLD)
        .setTitle('🏆 لوحة الصدارة — وقت اللعب')
        .setDescription(description)
        .setFooter({
          text: `طُلب بواسطة ${interaction.user.tag} | Top ${top.length} لاعبين`,
          iconURL: interaction.user.displayAvatarURL()
        })
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
