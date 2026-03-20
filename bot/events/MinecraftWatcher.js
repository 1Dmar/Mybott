const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const axios = require("axios");

module.exports = {
  name: "messageCreate",
  execute: async (message) => {
    if (!message || !message.author || message.author.bot || !message.guild) return;

    // Regex to detect potential Minecraft IP addresses (e.g., play.hypixel.net or 127.0.0.1:25565)
    const ipRegex = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?\b/gi;
    const matches = message.content.match(ipRegex);

    if (!matches) return;

    for (const ip of matches) {
      // Basic validation to avoid false positives (like common domains)
      const commonDomains = ["google.com", "discord.gg", "youtube.com", "github.com", "facebook.com", "twitter.com", "instagram.com", "tiktok.com"];
      if (commonDomains.some(domain => ip.toLowerCase().includes(domain))) continue;

      try {
        // Using a public API to fetch Minecraft server status
        const response = await axios.get(`https://api.mcsrvstat.us/3/${ip}`);
        const data = response.data;

        if (data.online) {
          const client = message.client;
          const embed = new EmbedBuilder()
            .setAuthor({ name: 'ProMcBot | Minecraft Royal Status', iconURL: client.user.displayAvatarURL() })
            .setTitle(`🏰 **تم رصد خادم ملكي نشط!**`)
            .setThumbnail(`https://api.mcsrvstat.us/icon/${ip}`)
            .setColor("#D4AF37") // Gold color for royal look
            .setDescription(`✨ **أهلاً بك أيها اللاعب! لقد قمنا بتحليل العنوان المذكور في المحادثة:**\n\n` +
                            `🔱 **اسم الخادم:** \`${data.hostname || ip}\`\n` +
                            `💎 **الإصدار:** \`${data.version || "غير معروف"}\`\n` +
                            `👥 **اللاعبين:** \`${data.players.online}/${data.players.max}\`\n` +
                            `📶 **الحالة:** \`متصل ✅\``)
            .addFields(
              { name: '📜 وصف الخادم', value: `\`\`\`${data.motd?.clean?.join('\n') || 'لا يوجد وصف متاح'}\`\`\`` },
              { name: '🛠️ النوع', value: `\`${data.software || 'Vanilla'}\``, inline: true },
              { name: '📍 العنوان', value: `\`${ip}\``, inline: true }
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
          break; // Only show status for the first valid IP found to avoid spam
        }
      } catch (error) {
        // Silently ignore errors
      }
    }
  },
};
