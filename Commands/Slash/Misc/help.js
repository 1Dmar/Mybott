const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
  Client,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

const COMMANDS = {
  '⚔️ ماين كرافت': [
    '`/mc-setup` — ربط سيرفر الماين كرافت',
    '`/mc-player` — معلومات لاعب',
    '`/mc-players` — اللاعبون المتصلون',
    '`/mc-execute` — تنفيذ أمر (أدمن)',
    '`/mc-info` — معلومات السيرفر',
    '`/mc-leaderboard` — لوحة الصدارة',
  ],
  '🛡️ السيرفر': [
    '`/setup_server` — إعداد سيرفر الماين كرافت',
    '`/setup_log` — إعداد قنوات السجل',
    '`/blacklist` — القائمة السوداء',
    '`/language` — تغيير لغة البوت',
    '`/bump` — ترقية السيرفر',
    '`/generate-apikey` — توليد API Key',
    '`/link-apikey` — ربط API Key',
  ],
  '🔧 الأتمتة': [
    '`/automod settings` — إعدادات الأتمتة',
    '`/automod toggle` — تفعيل/تعطيل',
    '`/automod filter` — فلاتر الكلمات',
    '`/automod action` — الإجراءات التلقائية',
    '`/automod whitelist` — القائمة البيضاء',
  ],
  '📊 الإحصائيات': [
    '`/status` — حالة البوت والسيرفر',
    '`/statusbar setup` — شريط الحالة',
    '`/stats` — إحصائيات اللاعبين',
    '`/topservers` — أفضل السيرفرات',
    '`/ping` — استجابة البوت',
  ],
  '🎮 متنوع': [
    '`/help` — قائمة المساعدة',
    '`/invite` — دعوة البوت',
    '`/avatar` — عرض الصورة الرمزية',
    '`/playercard` — بطاقة لاعب',
    '`/support` — سيرفر الدعم',
    '`/koth` — KOTH announcement',
  ],
};

module.exports = {
  name: 'help',
  description: 'عرض قائمة المساعدة والأوامر المتاحة',
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Misc',
  type1: 'slash',
  type: ApplicationCommandType.ChatInput,
  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   */
  run: async (client, interaction) => {
    const categoryKeys = Object.keys(COMMANDS);
    let currentCategory = categoryKeys[0];

    const buildEmbed = (category) => {
      const cmds = COMMANDS[category];
      return new EmbedBuilder()
        .setColor(0x7C3AED)
        .setAuthor({ name: `${client.user.username} — المساعدة`, iconURL: client.user.displayAvatarURL() })
        .setTitle(`${category}`)
        .setDescription(cmds.join('\n'))
        .addFields({
          name: '📖 الاستخدام',
          value: 'اختر فئة من القائمة أدناه لعرض أوامرها',
          inline: false,
        })
        .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
        .setFooter({
          text: `Developed with ❤️ by 1Dmar • ${client.user.username} | ${Object.values(COMMANDS).flat().length} أمر`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();
    };

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('📂 اختر فئة...')
      .addOptions(categoryKeys.map(cat => ({ label: cat, value: cat })));

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('سيرفر الدعم')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/6FjFYStz5a')
        .setEmoji('🔗'),
      new ButtonBuilder()
        .setLabel('دعوة البوت')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot+applications.commands`)
        .setEmoji('🚀'),
    );

    const msg = await interaction.reply({
      embeds: [buildEmbed(currentCategory)],
      components: [row1, row2],
      ephemeral: true,
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 120000,
    });

    collector.on('collect', async i => {
      if (i.customId === 'help_category') {
        currentCategory = i.values[0];
        await i.update({ embeds: [buildEmbed(currentCategory)], components: [row1, row2] });
      }
    });

    collector.on('end', () => {
      interaction.editReply({ components: [row2] }).catch(() => {});
    });
  },
};
