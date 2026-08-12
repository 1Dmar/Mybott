const {
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { getPlayers } = require('../../../utils/minecraftApi');

const C = { PRIMARY: 0x7C3AED, SUCCESS: 0x10B981, ERROR: 0xEF4444 };

module.exports = {
  name: 'mc-players',
  description: 'عرض قائمة اللاعبين المتصلين على سيرفر الماين كرافت',
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Minecraft',
  type1: 'slash',
  type: ApplicationCommandType.ChatInput,
  run: async (client, interaction) => {
    await interaction.deferReply();
    const guildId = interaction.guild.id;

    try {
      const data = await getPlayers(guildId);
      const players = data.players || [];
      const online = data.onlinePlayers ?? players.length;
      const max = data.maxPlayers ?? '?';

      const playerList = players.length > 0
        ? players.map((p, i) => `\`${(i + 1).toString().padStart(2, '0')}\` **${p.username || p}**`).join('\n')
        : '*لا يوجد لاعبون متصلون الآن*';

      const fillBar = max !== '?' && max > 0
        ? (() => {
            const pct = Math.min(1, online / max);
            const filled = Math.round(pct * 10);
            return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${Math.round(pct * 100)}%`;
          })()
        : 'N/A';

      const embed = new EmbedBuilder()
        .setColor(online > 0 ? C.SUCCESS : C.PRIMARY)
        .setTitle('👥 اللاعبون المتصلون')
        .setDescription(playerList)
        .addFields(
          { name: '🟢 متصل',         value: `\`${online}\``,   inline: true },
          { name: '📊 الحد الأقصى',   value: `\`${max}\``,     inline: true },
          { name: '📈 نسبة الإشغال',  value: `\`${fillBar}\``, inline: false },
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
