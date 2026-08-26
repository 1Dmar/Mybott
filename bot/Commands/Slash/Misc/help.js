'use strict';

const {
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

function getCatalog(client) {
  const catalog = Array.isArray(client.commandCatalog) ? client.commandCatalog : [];
  return catalog.length ? catalog : [{ name: 'help', description: 'عرض أوامر ProMcBot المنظمة', category: 'Utility', subcommands: [] }];
}

function commandLines(group) {
  if (!group.subcommands?.length) return [`\`/${group.name}\` — ${group.description}`];
  return group.subcommands.map(command => `\`/${group.name} ${command.name}\` — ${command.description}`);
}

module.exports = {
  name: 'help',
  description: 'عرض أوامر ProMcBot المنظمة',
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: 'Utility',
  type: ApplicationCommandType.ChatInput,
  type1: 'slash',
  run: async (client, interaction) => {
    const catalog = getCatalog(client);
    const categoryNames = [...new Set(catalog.map(group => group.category || 'Commands'))];
    let currentCategory = categoryNames[0];

    const buildEmbed = category => {
      const groups = catalog.filter(group => (group.category || 'Commands') === category);
      const lines = groups.flatMap(commandLines);
      return new EmbedBuilder()
        .setColor(0x7C3AED)
        .setAuthor({ name: `${client.user?.username || 'ProMcBot'} — Command Center`, iconURL: client.user?.displayAvatarURL?.() })
        .setTitle(`أوامر ${category}`)
        .setDescription(lines.join('\n').slice(0, 3900) || 'لا توجد أوامر متاحة في هذه الفئة.')
        .addFields({
          name: 'التنظيم الجديد',
          value: 'الأوامر مجمّعة تحت مجموعات واضحة. العمليات المعقدة متاحة من لوحة التحكم.',
          inline: false,
        })
        .setFooter({ text: 'ProMcBot • مصدر الأوامر هو registry واحد' })
        .setTimestamp();
    };

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('اختر فئة الأوامر')
      .addOptions(categoryNames.map(category => ({ label: category.slice(0, 100), value: category.slice(0, 100) })));

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('سيرفر الدعم')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/6FjFYStz5a'),
      new ButtonBuilder()
        .setLabel('دعوة البوت')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot+applications.commands`),
    );

    const menuRow = new ActionRowBuilder().addComponents(selectMenu);
    const message = await interaction.reply({
      embeds: [buildEmbed(currentCategory)],
      components: [menuRow, buttons],
      ephemeral: true,
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      filter: component => component.user.id === interaction.user.id,
      time: 120000,
    });
    collector.on('collect', async component => {
      if (component.customId !== 'help_category') return;
      currentCategory = component.values[0];
      await component.update({ embeds: [buildEmbed(currentCategory)], components: [menuRow, buttons] });
    });
    collector.on('end', () => interaction.editReply({ components: [buttons] }).catch(() => {}));
  },
};
