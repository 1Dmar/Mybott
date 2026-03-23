const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");
const axios = require("axios");
const Server = require("../../../Models/Server");

module.exports = {
  name: "info",
  description: "Show Minecraft server status in a better way",
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Misc",
  cooldown: 5,
  type1: "message",
  membership: false,

  /**
   * @param {Client} client
   * @param {Message} message
   * @param {String[]} args
   * @param {String} prefix
   */
  run: async (client, message, args, prefix) => {
    let ip = args.join(" ").trim();

    // If no IP is provided, use the default server IP from MongoDB
    if (!ip) {
      const serverData = await Server.findOne({ serverId: message.guild.id });

      if (serverData?.javaIP) {
        ip = serverData.javaIP;
      } else {
        return message.reply({
          content:
            `${client.emojis.ERROR} **Sorry! No server address was provided, and no default address is saved for this server.**\n` +
            `> Use: \`${prefix}mc <IP>\``,
        });
      }
    }

    const loadingMsg = await message.reply({
      content: "⏳ Fetching server data...",
    });

    try {
      const response = await axios.get(
        `https://api.mcsrvstat.us/3/${encodeURIComponent(ip)}`
      );

      const data = response.data;

      if (!data.online) {
        return loadingMsg.edit({
          content: `${client.emojis.ERROR} **Sorry! The server \`${ip}\` is currently offline.**`,
          embeds: [],
          components: [],
        });
      }

      const motd =
        data.motd?.clean?.length > 0
          ? data.motd.clean.join("\n")
          : "No description available.";

      const embed = new EmbedBuilder()
        .setAuthor({
          name: "ProMcBot | Minecraft Server Info",
          iconURL: client.user.displayAvatarURL(),
        })
        .setTitle("🏰 Minecraft Server Status")
        .setThumbnail(`https://api.mcsrvstat.us/icon/${encodeURIComponent(ip)}`)
        .setColor("#D4AF37")
        .setDescription(
          `${client.emojis.SPARKLES} **Here is the full information for the selected server:**\n\n` +
            `${client.emojis.DIAMOND} **Version:** \`${data.version || "Unknown"}\`\n` +
            `${client.emojis.MEMBERS} **Players:** \`${data.players?.online ?? 0}/${data.players?.max ?? 0}\`\n` +
            `📶 **Status:** \`Online ${client.emojis.SUCCESS}\``
        )
        .addFields(
          {
            name: "📜 Server Description",
            value: `\`\`\`${motd}\`\`\``,
          },
          {
            name: "${client.emojis.PIN} Full Address",
            value: `\`${data.hostname || data.ip || ip}\``,
            inline: true,
          },
          {
            name: "🛠️ Software",
            value: `\`${data.software || "Vanilla"}\``,
            inline: true,
          }
        )
        .setImage(`https://api.mcsrvstat.us/debug/ping/${encodeURIComponent(ip)}`)
        .setFooter({
          text: "Monitoring System | ProMcBot",
          iconURL: client.user.displayAvatarURL(),
        })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Bot Support")
          .setStyle(ButtonStyle.Link)
          .setURL("https://discord.gg/1Dmar"),
        new ButtonBuilder()
          .setLabel("Official Website")
          .setStyle(ButtonStyle.Link)
          .setURL("https://promcbot.qzz.io/")
        .setDisabled(true)
      );

      await loadingMsg.edit({
        content: null,
        embeds: [embed],
        components: [row],
      });
    } catch (error) {
      console.error("Minecraft server info error:", error);
      await loadingMsg.edit({
        content:
          "${client.emojis.ERROR} **An error occurred while fetching the server data. Please make sure the address is correct.**",
        embeds: [],
        components: [],
      });
    }
  },
};
