const { Message, PermissionFlagsBits, Client } = require("discord.js");
const Server = require("../../../Models/User"); // تأكد من أن هذا المسار صحيح

module.exports = {
  name: "delmembership",
  description: `remove membership from server`,
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
    // Code
    if (message.author.id !== "804999528129363998" && message.author.id !== "1071690719418396752") return;

    const serverId = args[0];
    if (!serverId) {
      return message.reply({
        content: `> Please provide a server ID `,
      });
    }
    let data = client.userSettings.get(serverId);
    if (!data?.ismembership) {
      return message.reply({
        content: `Server with ID \`${serverId}\` is not a MemberShip server`,
      });
    } else {
      await Server.findOneAndRemove({ Id: serverId });
      await client.userSettings.delete(serverId);
      return message.reply({
        content: `MemberShip removed from server with ID \`${serverId}\``,
      });
    }
  },
};
