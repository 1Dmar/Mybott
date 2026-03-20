const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const axios = require("axios");
const Server = require("../Models/Server");

module.exports = {
  name: "messageCreate",
  execute: async (message) => {
    if (!message || !message.author || message.author.bot || !message.guild) return;

    // 1. Check if watcher is enabled for this server in MongoDB
    const serverData = await Server.findOne({ serverId: message.guild.id });
    if (!serverData || !serverData.watcherEnabled) return;

    // 2. Regex to detect Minecraft IP addresses
    const ipRegex = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?\b/gi;
    const matches = message.content.match(ipRegex);

    if (!matches) return;

    for (const ip of matches) {
      // Basic validation to avoid common false positives
      const commonDomains = ["google.com", "discord.gg", "youtube.com", "github.com", "facebook.com", "twitter.com", "instagram.com", "tiktok.com"];
      if (commonDomains.some(domain => ip.toLowerCase().includes(domain))) continue;

      try {
        const response = await axios.get(`https://api.mcsrvstat.us/3/${ip}`);
        const data = response.data;

        if (data.online) {
          const client = message.client;
          const embed = new EmbedBuilder()
            .setAuthor({ name: 'ProMcBot | Minecraft Royal Watcher', iconURL: client.user.displayAvatarURL() })
            .setTitle(`🏰 **تم رصد خادم ملكي نشط!**`)
            .setThumbnail(`https://api.mcsrvstat.us/icon/${ip}`)
            .setColor("#D4AF37") // Royal Gold
            .setDescription(`✨ **أهلاً بك أيها الملك! لقد قمنا بتحليل العنوان المذكور في المحادثة:**\n\n` +
                            `🔱 **اسم الخادم:** \`${data.hostname || ip}\`\n` +
                            `💎 **الإصدار:** \`${data.version || "غير معروف"}\`\n` +
                            `👥 **اللاعبين:** \`${data.players.online}/${data.players.max}\`\n` +
                            `📶 **الحالة:** \`متصل ✅\``)
            .addFields(
              { name: '📜 وصف الخادم', value: `\`\`\`${data.motd?.clean?.join('\n') || 'لا يوجد وصف متاح'}\`\`\`` },
              { name: '📍 العنوان', value: `\`${ip}\``, inline: true },
              { name: '🛠️ النوع', value: `\`${data.software || 'Vanilla'}\``, inline: true }
            )
            .setImage(`https://api.mcsrvstat.us/debug/ping/${ip}`)
            .setFooter({ text: "نظام المراقبة الملكي | ProMcBot", iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setLabel('دعم البوت')
                .setStyle(ButtonStyle.Link)
                .setURL('https://discord.gg/1Dmar'),
              new ButtonBuilder()
                .setLabel('الموقع الرسمي')
                .setStyle(ButtonStyle.Link)
                .setURL('https://promcbot.com')
            );

          await message.reply({ embeds: [embed], components: [row] });
          break; // One IP per message to avoid spam
        }
      } catch (error) {
        // Silent error handling
      }
    }
  },
};
