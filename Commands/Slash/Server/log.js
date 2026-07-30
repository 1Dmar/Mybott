const { ApplicationCommandType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Log = require('../../../Models/Log');

const LOG_TYPES = [
  'MessageDelete', 'MessageUpdate', 'GuildMemberAdd', 'GuildMemberRemove',
  'RoleCreate', 'RoleDelete', 'GuildBanAdd', 'GuildBanRemove',
  'ChannelCreate', 'ChannelDelete', 'EmojiCreate', 'EmojiDelete',
  'VoiceStateUpdateJoin', 'VoiceStateUpdateLeave', 'VoiceStateUpdateMove',
];

module.exports = {
  name: 'setup_log',
  description: 'إعداد قنوات السجل لأحداث السيرفر',
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Server',
  type1: 'slash',
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: 'log_type',
      description: 'نوع السجل',
      type: 3,
      required: true,
      choices: LOG_TYPES.map(t => ({ name: t, value: t })),
    },
    {
      name: 'channel',
      description: 'القناة التي ستستقبل السجلات',
      type: 7,
      required: true,
    },
  ],
  run: async (client, interaction) => {
    const logType = interaction.options.getString('log_type');
    const channel = interaction.options.getChannel('channel');

    if (!LOG_TYPES.includes(logType)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF4444)
            .setTitle('❌ نوع سجل غير صحيح')
            .setDescription(`الأنواع المتاحة: ${LOG_TYPES.map(t => `\`${t}\``).join(', ')}`)
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    if (!channel) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF4444)
            .setTitle('❌ قناة غير صحيحة')
            .setDescription('يرجى اختيار قناة صحيحة.')
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    // Remove existing and add new
    await Log.findOneAndUpdate(
      { serverId: interaction.guild.id },
      { $pull: { logs: { logType } } },
      { upsert: true }
    );
    await Log.findOneAndUpdate(
      { serverId: interaction.guild.id },
      { $push: { logs: { logType, logChannelId: channel.id } } },
      { upsert: true }
    );

    const successEmbed = new EmbedBuilder()
      .setColor(0x10B981)
      .setTitle('✅ تم إعداد السجل')
      .setDescription(`سيتم إرسال سجلات **${logType}** إلى ${channel}.`)
      .addFields(
        { name: '📋 النوع',   value: `\`${logType}\``,      inline: true },
        { name: '📣 القناة',  value: `<#${channel.id}>`,   inline: true },
      )
      .setFooter({ text: `أُعِدَّ بواسطة ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
  },
};
