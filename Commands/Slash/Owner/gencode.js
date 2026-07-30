const { CommandInteraction, ApplicationCommandType, PermissionFlagsBits, Client, EmbedBuilder } = require("discord.js");
const moment = require("moment");
const voucher_codes = require("voucher-code-generator");
const schema = require("../../../Models/Code");

module.exports = {
  name: "gencode",
  description: "Generate premium codes",
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Owner",
  type: ApplicationCommandType.ChatInput,
  type1: "slash",
  options: [
    {
      name: 'port',
      description: 'The server port to bind this premium code to',
      type: 4, // Integer type
      required: true,
    },
    {
      name: 'days',
      description: 'The duration in days',
      type: 4, // Integer type
      required: true,
    }
  ],
  run: async (client, interaction, args) => {
    const port = interaction.options.getInteger('port');
    const daysValid = interaction.options.getInteger('days');

    const { generatePremiumKey } = require('../../../utils/premiumCode');
    const premiumCode = generatePremiumKey(port, daysValid);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("Blurple")
          .setTitle(`Generated Premium Code`)
          .setDescription(`Your Premium Code for Port **${port}** (Valid for ${daysValid} days):\n\`\`\`\n${premiumCode}\n\`\`\``)
          .setFooter({ text: `Use this code to verify in the endpoints` }),
      ],
      ephemeral: true,
    });
  },
};
