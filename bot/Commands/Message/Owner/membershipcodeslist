const {
  Message,
  PermissionFlagsBits,
  Client,
  EmbedBuilder,
} = require("discord.js");
const schema = require("../../../Models/Code");
const moment = require("moment");

module.exports = {
  name: "mscodeslist",
  description: `List saved, available, and unused membership codes`,
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

    try {
      // Fetch codes from the database that are not expired and not used
      const codes = await schema.find({ 
        expiresAt: { $gte: Date.now() }, 
        used: { $ne: true }
      });

      if (!codes.length) {
        return message.reply("No unused codes available.");
      }

      const codeList = codes.map((code, index) => {
        const expiresIn = moment.duration(code.expiresAt - Date.now());

        const timeUnits = [
          { value: expiresIn.years(), label: 'years' },
          { value: expiresIn.months(), label: 'months' },
          { value: expiresIn.days(), label: 'days' },
          { value: expiresIn.hours(), label: 'hours' },
          { value: expiresIn.minutes(), label: 'minutes' },
        ];

        const expiresAt = timeUnits
          .filter(unit => unit.value > 0)
          .map(unit => `${unit.value} ${unit.label}`)
          .join(', ');

        return `\`\`\`#${index + 1} ${code.code} | ${code.plan} | Expires in: ${expiresAt}\`\`\``;
      }).join("\n");

      message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("Blurple")
            .setTitle(`Available Unused Codes`)
            .setDescription(
              `${codeList}`
            )
            .setFooter({
              text: `To redeem, use ${prefix}claim <code>`,
            }),
        ],
      });
    } catch (error) {
      console.error(error);
      message.reply("An error occurred while fetching the codes.");
    }
  },
};
