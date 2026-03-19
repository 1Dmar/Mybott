const {
  Message,
  PermissionFlagsBits,
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const moment = require("moment");

module.exports = {
  name: "mslist",
  description: `show all membership servers`,
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Owner",
    type1: "message",
  /**
   *
   * @param {Client} client
   * @param {Message} message
   * @param {String[]} args
   * @param {String} prefix
   */
  run: async (client, message, args, prefix) => {
    if (message.author.id !== "804999528129363998" && message.author.id !== "1071690719418396752") return;

      
    const data = client.userSettings.filter((data) => data?.ismembership === true);

    if (data.size === 0) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`All MemberShip Servers`)
            .setColor("Blurple")
            .setDescription("No MemberShip server found"),
        ],
      });
    }

    const servers = Array.from(data.values()).map((data) => ({
      id: data.Id,
      name: client.guilds.cache.get(data.Id)?.name || "Unknown Server",
      plan: data.membership.plan,
      expiresAt: Math.floor(data.membership.expiresAt / 1000),
    }));

    let page = 0;
    const pageSize = 5;
    const totalPages = Math.ceil(servers.length / pageSize);

    const generateEmbed = (page) => {
      const start = page * pageSize;
      const end = start + pageSize;
      const serverList = servers.slice(start, end)
        .map((server) => `Server Name: ${server.name} \nServer ID: ${server.id} \n**Plan**: \`${server.plan}\` \n**Expire At**: <t:${server.expiresAt}:F>\n`)
        .join("\n");

      return new EmbedBuilder()
        .setTitle(`All MemberShip Servers (Page ${page + 1}/${totalPages})`)
        .setColor("Blurple")
        .setDescription(serverList || "No MemberShip server found");
    };

    const generateButtons = (page) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('previous')
          .setLabel('Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Next')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages - 1)
      );
    };

    const embedMessage = await message.reply({
      embeds: [generateEmbed(page)],
      components: [generateButtons(page)],
    });

    const collector = embedMessage.createMessageComponentCollector({
      filter: (interaction) => interaction.user.id === message.author.id,
      time: 60000, // 60 seconds
    });

    collector.on('collect', (interaction) => {
      if (interaction.customId === 'previous') {
        page--;
      } else if (interaction.customId === 'next') {
        page++;
      }

      interaction.update({
        embeds: [generateEmbed(page)],
        components: [generateButtons(page)],
      });
    });

    collector.on('end', () => {
      embedMessage.edit({
        components: [],
      });
    });
  },
};
