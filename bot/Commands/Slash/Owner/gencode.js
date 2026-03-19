const { CommandInteraction, ApplicationCommandType, PermissionFlagsBits, Client, EmbedBuilder } = require("discord.js");
const moment = require("moment");
const voucher_codes = require("voucher-code-generator");
const schema = require("../../../Models/Code");

module.exports = {
  name: "gencode",
  description: "Generate membership codes",
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Owner",
  type: ApplicationCommandType.ChatInput,
  type1: "slash",
  options: [
    {
      name: 'plan',
      description: 'The plan for the membership code (daily, weekly, monthly, yearly)',
      type: 3, // String type
      required: true,
    },
    {
      name: 'amount',
      description: 'The number of codes to generate',
      type: 4, // Integer type
      required: false,
    }
  ],
  run: async (client, interaction, args) => {
    const plan = interaction.options.getString('plan');
    const amount = interaction.options.getInteger('amount') || 1;
    const codes = [];
    const plans = ["daily", "weekly", "monthly", "yearly"];
    let time;

    if (!plans.includes(plan)) {
      return interaction.reply(`Available Plans: \n > \`${plans.join(", ")}\``);
    }
    if (plan === "daily") time = Date.now() + 86400000;
    if (plan === "weekly") time = Date.now() + 86400000 * 7;
    if (plan === "monthly") time = Date.now() + 86400000 * 30;
    if (plan === "yearly") time = Date.now() + 86400000 * 365;

    for (let i = 0; i < amount; i++) {
      const codeMemberShip = voucher_codes.generate({ pattern: "####-#####-###-####" });
      const code = codeMemberShip.toString().toUpperCase();
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

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("Blurple")
          .setTitle(`Generated ${codes.length} Codes`)
          .setDescription(`\`\`\`\n${codes.join("\n") || "No Codes Generated"} \`\`\``)
          .addFields([{ name: 'Expire At', value: `<t:${Math.floor(time / 1000)}:F>` }])
          .setFooter({ text: `To redeem, use !redeem <code>` }),
      ],
      ephemeral: true,
    });
  },
};
