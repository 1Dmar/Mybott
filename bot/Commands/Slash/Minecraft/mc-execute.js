const {
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
  ApplicationCommandOptionType,
} = require('discord.js');
const { executeCommand } = require('../../../utils/minecraftApi');

const C = { PRIMARY: 0x7C3AED, GOLD: 0xF59E0B, SUCCESS: 0x10B981, ERROR: 0xEF4444 };

module.exports = {
  name: 'mc-execute',
  description: 'تنفيذ أمر على سيرفر الماين كرافت (أدمن فقط)',
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Minecraft',
  type1: 'slash',
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: 'command',
      description: 'الأمر المراد تنفيذه (بدون /)، مثال: give Steve diamond 64',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'wait_for_player',
      description: 'انتظر حتى يدخل هذا اللاعب قبل تنفيذ الأمر (اختياري)',
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: true });
    const command = interaction.options.getString('command').trim();
    const waitForPlayer = interaction.options.getString('wait_for_player') || null;
    const guildId = interaction.guild.id;

    try {
      const result = await executeCommand(guildId, [command], waitForPlayer);

      // status 202 = pending (wait for player)
      const isPending = result.pending || (result.statuses && result.statuses[0] === 'pending');
      const isPassed  = !isPending && result.statuses && result.statuses[0] === 'passed';

      const embed = new EmbedBuilder()
        .setColor(isPending ? C.GOLD : isPassed ? C.SUCCESS : C.ERROR)
        .setTitle(isPending ? '⏳ الأمر في الانتظار' : isPassed ? '✅ تم تنفيذ الأمر' : '⚠️ فشل الأمر')
        .setDescription(
          isPending
            ? `سيتم تنفيذ الأمر عندما يدخل **${waitForPlayer}** السيرفر.`
            : isPassed
            ? 'تم تنفيذ الأمر بنجاح على السيرفر.'
            : 'فشل تنفيذ الأمر على السيرفر.'
        )
        .addFields(
          { name: '💻 الأمر', value: `\`${command}\``, inline: false },
          ...(waitForPlayer ? [{ name: '👤 انتظار اللاعب', value: `\`${waitForPlayer}\``, inline: true }] : []),
          ...(result.outputs && result.outputs[0] ? [{ name: '📤 الناتج', value: `\`\`\`\n${String(result.outputs[0]).substring(0, 900)}\n\`\`\`` }] : []),
        )
        .setFooter({ text: `نُفِّذ بواسطة ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const errEmbed = new EmbedBuilder()
        .setColor(C.ERROR)
        .setTitle('❌ خطأ في التنفيذ')
        .setDescription(
          err.message === 'NO_MC_CONFIG'
            ? '⚠️ لم يتم ربط سيرفر ماين كرافت بعد! استخدم `/mc-setup` أولاً.'
            : err.response?.status === 401
            ? '❌ خطأ في المصادقة — استخدم `/mc-setup` لتحديث الإعدادات.'
            : `❌ خطأ: \`${err.message}\``
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [errEmbed] });
    }
  },
};
