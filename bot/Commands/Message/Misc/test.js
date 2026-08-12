const { AttachmentBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "mybot",
  description: "Show a player card with their Minecraft profile",
  userPermissions: PermissionFlagsBits.Administrator,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Misc",
  cooldown: 5,
  type1: "message",
  membership: false,

  run: async (client, message, args, prefix) => {


    const loadingMsg = await message.reply({
      content: `${client.guilds.cache.size}`
    });

  }
};
