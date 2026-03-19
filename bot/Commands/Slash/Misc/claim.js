const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const moment = require("moment");
const Code = require("../../../Models/Code");
const Server = require("../../../Models/User"); // تأكد من أن هذا المسار صحيح

module.exports = {
  name: "claim",
  description: "Redeem membership codes",
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Misc",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: 'code',
      description: 'The membership code to redeem',
      type: 3, // String type
      required: true,
    }
  ],
  run: async (client, interaction, args) => {
    const code = interaction.options.getString('code');
    const guildId = interaction.guild.id;
    const guildName = interaction.guild.name;

    let server = await Server.findOne({
      Id: guildId,
    });

    if (!code) {
      return interaction.reply({
        content: `**Please specify the code you want to redeem!**`,
        ephemeral: true,
      });
    } else if (server && server.ismembership) {
      return interaction.reply({
        content: `**> This server is already in membership mode**`,
        ephemeral: true,
      });
    } else {
      const membership = await Code.findOne({
        code: code.toUpperCase(),
      });

      if (membership) {
        const expires = moment(membership.expiresAt).format("dddd, MMMM Do YYYY HH:mm:ss");

        if (!server) {
          server = new Server({
            Id: guildId,
            ismembership: false,
            membership: {
              redeemedBy: [],
              redeemedAt: null,
              expiresAt: null,
              plan: null,
            },
          });
        }

        server.ismembership = true;
        server.membership.redeemedBy.push({
          id: guildId,
          tag: guildName,
        });
        server.membership.redeemedAt = Date.now();
        server.membership.expiresAt = membership.expiresAt;
        server.membership.plan = membership.plan;

        await server.save().catch((error) => {
          console.error(`Failed to save server: ${error}`);
        });

        membership.used = true;
        await membership.save().catch((error) => {
          console.error(`Failed to save membership: ${error}`);
        });

        const targetRoom = await interaction.client.channels.fetch('1273517280747065427');
        if (!targetRoom) return console.error('Invalid target room ID!');

        const embed = new EmbedBuilder()
          .setColor(0xefc75e)
          .setTitle(`New code claimer has been saved from ${guildName}`)
          .addFields(
            { name: 'Server Id', value: `( ${guildId} )`, inline: true },
            { name: 'Code', value: ` \`${code}\` `, inline: true },
            { name: 'Plan', value: ` ${membership.plan} `, inline: true },
            { name: 'Redeem By', value: ` ${interaction.user.tag} `, inline: true },
            { name: 'Redeem At', value: ` ${moment().format('dddd, MMMM Do YYYY HH:mm:ss') }`, inline: true },
          )
          .setTimestamp();

        await targetRoom.send({ embeds: [embed] });

        return interaction.reply({
          content: `**You have successfully redeemed membership!**\n\n\`Expires at: ${expires}\``,
          ephemeral: true,
        });
      } else {
        return interaction.reply({
          content: `**The code is invalid. Please try again using a valid one!**`,
          ephemeral: true,
        });
      }
    }
  },
};
