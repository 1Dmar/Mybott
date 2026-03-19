const { CommandInteraction, ApplicationCommandType, PermissionFlagsBits, Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const moment = require("moment");

module.exports = {
  name: "mslist",
  description: "Show all membership servers",
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Owner",
  type: ApplicationCommandType.ChatInput,
  type1: "slash",
  run: async (client, interaction, args) => {
    if (interaction.user.id !== "804999528129363998" && interaction.user.id !== "1071690719418396752") return;

    const data = client.userSettings.filter((data) => data?.ismembership === true);
    if (data.size === 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`All MemberShip Servers`)
            .setColor("Blurple")
            .setDescription("No MemberShip server found"),
        ],
        ephemeral: true,
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

    const embedMessage = await interaction.reply({
      embeds: [generateEmbed(page)],
      components: [generateButtons(page)],
      ephemeral: true,
    });

    const collector = embedMessage.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 60000, // 60 seconds
    });

    collector.on('collect', (i) => {
      if (i.customId === 'previous') {
        page--;
      } else if (i.customId === 'next') {
        page++;
      }

      i.update({
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
