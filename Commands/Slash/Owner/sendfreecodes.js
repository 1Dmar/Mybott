const { CommandInteraction, ApplicationCommandType, PermissionFlagsBits, Client, EmbedBuilder } = require("discord.js");
const moment = require("moment");
const voucher_codes = require("voucher-code-generator");
const schema = require("../../../Models/Code");

module.exports = {
  name: "sendfreecodes",
  description: "Generate membership codes and send them",
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Owner",
  type: ApplicationCommandType.ChatInput,
  type1: "slash",
  run: async (client, interaction, args) => {
    if (interaction.user.id !== "804999528129363998" && interaction.user.id !== "1071690719418396752") return;

    const logChannelId = '1058107844878147696'; // استبدل بمعرف القناة الخاص باللوق

    client.guilds.cache.forEach(async (guild) => {
      try {
        const owner = await guild.fetchOwner();
        const code = voucher_codes.generate({ pattern: "####-#####-###-####" }).toString().toUpperCase();
        const expiresAt = Date.now() + 86400000 * 7; // أسبوع

        await schema.create({
          code: code,
          plan: 'custom',
          expiresAt: expiresAt,
        });

        const embed = new EmbedBuilder()
          .setColor('Blurple')
          .setTitle(`Generated Membership Code By ${interaction.user.username}`)
          .setDescription(`\`\`\`${code}\`\`\``)
          .addFields([{ name: 'Expires At', value: `<t:${Math.floor(expiresAt / 1000)}:F>` }])
          .setFooter({ text: `To redeem, use your bot's redeem command (!claim \`\`\`${code}\`\`\`)` });

        let recipient = null;

        try {
          await owner.send({ embeds: [embed] });
          recipient = owner.user;
          console.log(`Sent code to ${owner.user.tag} (${owner.id})`);
        } catch (error) {
          console.error(`Could not send code to the owner of ${guild.name}:`, error);

          const admin = guild.members.cache.find(member => member.permissions.has(PermissionFlagsBits.Administrator));
          if (admin) {
            try {
              await admin.send({ embeds: [embed] });
              recipient = admin.user;
              console.log(`Sent code to ${admin.user.tag} (${admin.id})`);
            } catch (adminError) {
              console.error(`Could not send code to an admin of ${guild.name}:`, adminError);
            }
          } else {
            console.error(`No admin found in ${guild.name}`);
          }
        }

        if (recipient) {
          const logEmbed = new EmbedBuilder()
            .setColor('Green')
            .setTitle(`Code Sent`)
            .setDescription(`A code was successfully sent.`)
            .addFields([
              { name: 'Guild', value: guild.name, inline: true },
              { name: 'Recipient', value: recipient.tag, inline: true },
              { name: 'Code', value: code, inline: false },
            ])
            .setTimestamp();

          const logChannel = client.channels.cache.get(logChannelId);
          if (logChannel && logChannel.isTextBased()) {
            logChannel.send({ embeds: [logEmbed] });
          } else {
            console.error(`Log channel not found or not a text channel.`);
          }
        }
      } catch (fetchError) {
        console.error(`Could not fetch owner for ${guild.name}:`, fetchError);
      }
    });
  },
};
