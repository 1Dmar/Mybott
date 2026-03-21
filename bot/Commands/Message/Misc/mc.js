const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");
const axios = require("axios");
const Server = require("../../../Models/Server");

module.exports = {
  name: "info",
  description: "عرض حالة خادم ماين كرافت بطريقة افضل",
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
    let ip = args[0];
    
    // If no IP provided, try to get the server's default IP from MongoDB
    if (!ip) {
      const serverData = await Server.findOne({ serverId: message.guild.id });
      if (serverData && serverData.javaIP) {
        ip = serverData.javaIP;
      } else {
        return message.reply({ content: `❌ **عذراً!، لم يتم تحديد عنوان خادم، ولا يوجد عنوان افتراضي مسجل لهذا السيرفر.**\n> استخدم: \`${prefix}mc <IP>\`` });
      }
    }

    const loadingMsg = await message.reply({ content: "جاري جلب بيانات الخادم...**" });

    try {
      const response = await axios.get(`https://api.mcsrvstat.us/3/${ip}`);
      const data = response.data;

      if (!data.online) {
        return loadingMsg.edit({ content: `❌ **عذراً! الخادم \`${ip}\` غير متصل حالياً.**` });
      }

      const embed = new EmbedBuilder()
        .setAuthor({ name: 'ProMcBot | Minecraft Royal Passport', iconURL: client.user.displayAvatarURL() })
        .setTitle(`🏰 **إحصائيات الخادم**`)
        .setThumbnail(`https://api.mcsrvstat.us/icon/${ip}`)
        .setColor("#D4AF37") // Royal Gold
        .setDescription(`✨ **أهلاً بك! إليك المعلومات الكاملة عن الخادم المختار:**\n\n` +
                        `🔱 **اسم الخادم:** \`${data.hostname || ip}\`\n` +
                        `💎 **الإصدار:** \`${data.version || "غير معروف"}\`\n` +
                        `👥 **اللاعبين:** \`${data.players.online}/${data.players.max}\`\n` +
                        `📶 **الحالة:** \`متصل ✅\``)
        .addFields(
          { name: '📜 وصف الخادم', value: `\`\`\`${data.motd?.clean?.join('\n') || 'لا يوجد وصف متاح'}\`\`\`` },
          { name: '📍 العنوان الكامل', value: `\`${ip}\``, inline: true },
          { name: '🛠️ النوع', value: `\`${data.software || 'Vanilla'}\``, inline: true }
        )
        .setImage(`https://api.mcsrvstat.us/debug/ping/${ip}`)
        .setFooter({ text: "نظام المراقبة | ProMcBot", iconURL: client.user.displayAvatarURL() })
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
            .setURL('https://promcbot.qzz.io/')
        );

      await loadingMsg.edit({ content: null, embeds: [embed], components: [row] });

    } catch (error) {
      await loadingMsg.edit({ content: `❌ **حدث خطأ أثناء محاولة جلب بيانات الخادم. تأكد من صحة العنوان.**` });
    }
  },
};
