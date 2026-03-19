const { CommandInteraction, ApplicationCommandType, PermissionFlagsBits, Client, EmbedBuilder } = require("discord.js");
const schema = require("../../../Models/Code");
const moment = require("moment");

module.exports = {
  name: "mscodeslist",
  description: "List saved, available, and unused membership codes",
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Owner",
  type: ApplicationCommandType.ChatInput,
  type1: "slash",
  run: async (client, interaction, args) => {
    if (interaction.user.id !== "804999528129363998" && interaction.user.id !== "1071690719418396752") return;

    try {
      const codes = await schema.find({ 
        expiresAt: { $gte: Date.now() }, 
        used: { $ne: true }
      });

      if (!codes.length) {
        return interaction.reply("No unused codes available.", { ephemeral: true });
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

      interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("Blurple")
            .setTitle(`Available Unused Codes`)
            .setDescription(`${codeList}`)
            .setFooter({ text: `To redeem, use !claim <code>` }),
        ],
        ephemeral: true,
      });
    } catch (error) {
      console.error(error);
      interaction.reply("An error occurred while fetching the codes.", { ephemeral: true });
    }
  },
};
