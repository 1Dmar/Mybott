const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");
const axios = require("axios");
const Server = require("../../../Models/Server");
const PluginInstance = require("../../../Models/PluginInstance");

const PLUGIN_FRESHNESS_MS = 15 * 60 * 1000;

const formatEmoji = (emoji) => {
    if (!emoji) return "";
    if (typeof emoji === 'string') return emoji;
    if (emoji.id) {
        return `<${emoji.animated ? "a" : ""}:emoji:${emoji.id}>`;
    }
    return "";
};

module.exports = {
  name: "mc",
  aliases: ["info"],
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

    // The first source of truth is the signed first-party plugin heartbeat.
    // The external mcsrvstat lookup is only a fallback for servers without a connected plugin.
    if (!ip && message.guild?.id) {
      const plugin = await PluginInstance.findOne({ serverId: message.guild.id, revokedAt: null }).sort({ lastSeenAt: -1 }).lean();
      const pluginOnline = Boolean(plugin && (plugin.status === 'online' || (plugin.lastSeenAt && new Date(plugin.lastSeenAt).getTime() >= Date.now() - PLUGIN_FRESHNESS_MS)));
      if (pluginOnline) {
        const onlinePlayers = Number.isFinite(Number(plugin.lastOnlinePlayers)) ? Math.max(0, Number(plugin.lastOnlinePlayers)) : 0;
        return message.reply({
          embeds: [new EmbedBuilder()
            .setAuthor({ name: "ProMcBot | Minecraft Server Info", iconURL: client.user.displayAvatarURL() })
            .setTitle("🏰 Minecraft Server Status")
            .setColor("#22C55E")
            .setDescription(`${formatEmoji(client.emojis.ONLINE)} **Status:** \`Online\`\n${formatEmoji(client.emojis.MEMBERS)} **Players:** \`${onlinePlayers}\``)
            .addFields(
              { name: "Source", value: "ProMcBot plugin heartbeat", inline: true },
              { name: "Last heartbeat", value: `<t:${Math.floor(new Date(plugin.lastSeenAt).getTime() / 1000)}:R>`, inline: true },
              { name: "Server", value: `\`${plugin.serverName || message.guild.name}\``, inline: false },
            )
            .setFooter({ text: "Measured from your connected Minecraft plugin", iconURL: client.user.displayAvatarURL() })
            .setTimestamp()],
        });
      }
    }

    // If no IP is provided, use the default server IP from MongoDB
    if (!ip) {
      const serverData = await Server.findOne({ serverId: message.guild.id });

      if (serverData?.javaIP) {
        ip = serverData.javaIP;
      } else {
        return message.reply({
          content:
            `${formatEmoji(client.emojis.ERROR)} **Sorry! No server address was provided, and no default address is saved for this server.**\n` +
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
          content: `${formatEmoji(client.emojis.ERROR)} **Sorry! The server \`${ip}\` is currently offline.**`,
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
          `${formatEmoji(client.emojis.SPARKLES)} **Here is the full information for the selected server:**\n\n` +
            `${formatEmoji(client.emojis.DIAMOND)} **Version:** \`${data.version || "Unknown"}\`\n` +
            `${formatEmoji(client.emojis.MEMBERS)} **Players:** \`${data.players?.online ?? 0}/${data.players?.max ?? 0}\`\n` +
            `${formatEmoji(client.emojis.ONLINE)} **Status:** \`Online ${formatEmoji(client.emojis.SUCCESS)}\``
        )
        .addFields(
          {
            name: "📜 Server Description",
            value: `\`\`\`${motd}\`\`\``,
          },
          {
            name: `${formatEmoji(client.emojis.PIN)} Full Address`,
            value: `\`${data.hostname || data.ip || ip}\``,
            inline: true,
          },
          {
            name: `${formatEmoji(client.emojis.GEAR)} Software`,
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
          .setURL("https://promcbot.dev/")
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
          `${formatEmoji(client.emojis.ERROR)} **An error occurred while fetching the server data. Please make sure the address is correct.**`,
        embeds: [],
        components: [],
      });
    }
  },
};
