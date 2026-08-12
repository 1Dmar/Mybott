const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const moment = require("moment");
const Server = require("../../../Models/User"); 
const ServerInfo = require("../../../Models/Server");
const { generatePremiumKey } = require("../../../utils/premiumCode");

module.exports = {
  name: "claim",
<<<<<<< HEAD
  description: "Redeem premium codes",
=======
  description: "Activate premium for your server using your API port + days",
>>>>>>> copilot/update-bot-design-and-translation-system
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Misc",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
<<<<<<< HEAD
      name: 'code',
      description: 'The premium code to redeem',
      type: 3, // String type
=======
      name: 'days',
      description: 'Number of days for the premium subscription',
      type: 4, // Integer type
>>>>>>> copilot/update-bot-design-and-translation-system
      required: true,
    }
  ],
  run: async (client, interaction, args) => {
    // Defer immediately to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    // 1. Only server owner can use this
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.editReply({
        content: `**❌ Only the server owner can use this command!**`,
      });
    }

    const days = interaction.options.getInteger('days');
    const guildId = interaction.guild.id;
    const guildName = interaction.guild.name;

    // 2. Fetch server config to get the apiPort
    const serverConfig = await ServerInfo.findOne({ serverId: guildId });

    if (!serverConfig || !serverConfig.apiPort) {
      return interaction.editReply({
        content: `**❌ No API port configured for this server!**\nPlease set up your server first using the server setup, then try again.`,
      });
<<<<<<< HEAD
    } else if (server && server.ismembership) {
      return interaction.reply({
        content: `**> This server already has Premium enabled**`,
        ephemeral: true,
      });
    } else {
      const premiumCode = await Code.findOne({
        code: code.toUpperCase(),
      });

      if (premiumCode) {
        const expires = moment(premiumCode.expiresAt).format("dddd, MMMM Do YYYY HH:mm:ss");

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
        server.membership.expiresAt = premiumCode.expiresAt;
        server.membership.plan = premiumCode.plan;

        await server.save().catch((error) => {
          console.error(`Failed to save server: ${error}`);
        });

        premiumCode.used = true;
        await premiumCode.save().catch((error) => {
          console.error(`Failed to save premium code: ${error}`);
        });

        const targetRoom = await interaction.client.channels.fetch('1273517280747065427');
        if (!targetRoom) return console.error('Invalid target room ID!');

        const embed = new EmbedBuilder()
          .setColor(0xefc75e)
          .setTitle(`New code claimer has been saved from ${guildName}`)
          .addFields(
            { name: 'Server Id', value: `( ${guildId} )`, inline: true },
            { name: 'Code', value: ` \`${code}\` `, inline: true },
            { name: 'Plan', value: ` ${premiumCode.plan} `, inline: true },
            { name: 'Redeem By', value: ` ${interaction.user.tag} `, inline: true },
            { name: 'Redeem At', value: ` ${moment().format('dddd, MMMM Do YYYY HH:mm:ss') }`, inline: true },
          )
          .setTimestamp();

        await targetRoom.send({ embeds: [embed] });

        return interaction.reply({
          content: `**You have successfully redeemed Premium!**\n\n\`Expires at: ${expires}\``,
          ephemeral: true,
        });
      } else {
        return interaction.reply({
          content: `**The code is invalid. Please try again using a valid one!**`,
          ephemeral: true,
        });
      }
=======
>>>>>>> copilot/update-bot-design-and-translation-system
    }

    const apiPort = serverConfig.apiPort;

    // 3. Generate the premium key automatically using the server's apiPort
    const premiumKey = generatePremiumKey(apiPort, days);
    const expiresAt = Date.now() + (days * 24 * 60 * 60 * 1000);
    const expires = moment(expiresAt).format("dddd, MMMM Do YYYY HH:mm:ss");

    // 4. Save membership in Server (User model)
    let server = await Server.findOne({ Id: guildId });
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
      id: interaction.user.id,
      tag: interaction.user.tag,
    });
    server.membership.redeemedAt = Date.now();
    server.membership.expiresAt = expiresAt;
    server.membership.plan = `${days} days (Port ${apiPort})`;
    await server.save().catch((error) => console.error(`Failed to save server: ${error}`));

    // 5. Save the generated premiumKey in ServerInfo so playerCardGenerator can use it
    serverConfig.premiumKey = premiumKey;
    await serverConfig.save().catch((error) => console.error(`Failed to save server config: ${error}`));

    // 6. Log to bot owner channel
    const targetRoom = await interaction.client.channels.fetch('1273517280747065427').catch(() => null);
    if (targetRoom) {
      const embed = new EmbedBuilder()
        .setColor(0xefc75e)
        .setTitle(`✅ Premium Activated for ${guildName}`)
        .addFields(
          { name: 'Server Id', value: `( ${guildId} )`, inline: true },
          { name: 'API Port', value: `\`${apiPort}\``, inline: true },
          { name: 'Duration', value: `${days} days`, inline: true },
          { name: 'Activated By', value: ` ${interaction.user.tag} `, inline: true },
          { name: 'Expires At', value: expires, inline: false },
        )
        .setTimestamp();
      await targetRoom.send({ embeds: [embed] }).catch(() => null);
    }

    return interaction.editReply({
      content: `**✅ Premium activated successfully!**\n\n🔌 **API Port:** \`${apiPort}\`\n⏱️ **Duration:** ${days} days\n📅 **Expires at:** \`${expires}\`\n\nThe premium key has been saved to your server config automatically.`,
    });
  },
};


