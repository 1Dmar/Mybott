const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const moment = require("moment");
const Server = require("../../../Models/User"); 
const ServerInfo = require("../../../Models/Server");
const { verifyPremiumKey } = require("../../../utils/premiumCode");

module.exports = {
  name: "claim",
  description: "Redeem premium codes",
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Misc",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: 'code',
      description: 'The premium code to redeem',
      type: 3, // String type
      required: true,
    }
  ],
  run: async (client, interaction, args) => {
    // 1. Check if the user is the server owner
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({
        content: `**❌ Only the server owner can use this command!**`,
        ephemeral: true,
      });
    }

    const code = interaction.options.getString('code');
    const guildId = interaction.guild.id;
    const guildName = interaction.guild.name;

    if (!code) {
      return interaction.reply({
        content: `**Please specify the code you want to redeem!**`,
        ephemeral: true,
      });
    }

    // 2. Verify the code using our utility
    const verification = verifyPremiumKey(code);
    if (!verification || !verification.valid) {
      return interaction.reply({
        content: `**The code is invalid or expired. Please try again using a valid one!**`,
        ephemeral: true,
      });
    }

    const expiresAt = verification.expiresAt;
    const expires = moment(expiresAt).format("dddd, MMMM Do YYYY HH:mm:ss");

    // 3. Save the code in server settings
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
    server.membership.plan = `Port ${verification.port}`; // Just saving port info as plan
    await server.save().catch((error) => console.error(`Failed to save server: ${error}`));

    // 4. Save the premiumKey in ServerInfo so endpoints can use it
    let serverConfig = await ServerInfo.findOne({ serverId: guildId });
    if (!serverConfig) {
      serverConfig = new ServerInfo({ serverId: guildId });
    }
    serverConfig.premiumKey = code;
    await serverConfig.save().catch((error) => console.error(`Failed to save server config: ${error}`));

    const targetRoom = await interaction.client.channels.fetch('1273517280747065427').catch(() => null);
    if (targetRoom) {
      const embed = new EmbedBuilder()
        .setColor(0xefc75e)
        .setTitle(`New premium code claimer has been saved from ${guildName}`)
        .addFields(
          { name: 'Server Id', value: `( ${guildId} )`, inline: true },
          { name: 'Port Linked', value: ` \`${verification.port}\` `, inline: true },
          { name: 'Redeem By', value: ` ${interaction.user.tag} `, inline: true },
          { name: 'Redeem At', value: ` ${moment().format('dddd, MMMM Do YYYY HH:mm:ss') }`, inline: true },
        )
        .setTimestamp();
      await targetRoom.send({ embeds: [embed] }).catch(() => null);
    }

    return interaction.reply({
      content: `**✅ You have successfully redeemed premium!**\n\n\`Expires at: ${expires}\``,
      ephemeral: true,
    });
  },
};
