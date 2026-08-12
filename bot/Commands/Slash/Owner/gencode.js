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
<<<<<<< HEAD
      name: 'plan',
      description: 'The plan for the premium code (daily, weekly, monthly, yearly)',
      type: 3, // String type
=======
      name: 'port',
      description: 'The server port to bind this premium code to',
      type: 4, // Integer type
>>>>>>> copilot/update-bot-design-and-translation-system
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

<<<<<<< HEAD
    if (!plans.includes(plan)) {
      return interaction.reply(`Available Plans: \n > \`${plans.join(", ")}\``);
    }
    if (plan === "daily") time = Date.now() + 86400000;
    if (plan === "weekly") time = Date.now() + 86400000 * 7;
    if (plan === "monthly") time = Date.now() + 86400000 * 30;
    if (plan === "yearly") time = Date.now() + 86400000 * 365;

    for (let i = 0; i < amount; i++) {
      const codePremium = voucher_codes.generate({ pattern: "####-#####-###-####" });
      const code = codePremium.toString().toUpperCase();
      const find = await schema.findOne({ code: code });

      if (!find) {
        await schema.create({
          code: code,
          plan: plan,
          expiresAt: time,
        });
        codes.push(`${code}`);
      }
    }
=======
    const { generatePremiumKey } = require('../../../utils/premiumCode');
    const premiumCode = generatePremiumKey(port, daysValid);
>>>>>>> copilot/update-bot-design-and-translation-system

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
