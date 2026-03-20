const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const axios = require("axios");
const Server = require("../../../Models/Server");

module.exports = {
  name: "mc",
  description: "👑 عرض حالة خادم ماين كرافت بتصميم ملكي فخم",
  options: [
    {
      name: "ip",
      description: "عنوان الخادم (اختياري، سيتم استخدام عنوان السيرفر الافتراضي إذا لم يتم تحديده)",
      type: 3, // STRING
      required: false
    }
  ],
  
  run: async (client, interaction) => {
    await interaction.deferReply();
    
    let ip = interaction.options.getString("ip");
    
    // If no IP provided, try to get the server's default IP from MongoDB
    if (!ip) {
      const serverData = await Server.findOne({ serverId: interaction.guild.id });
      if (serverData && serverData.javaIP) {
        ip = serverData.javaIP;
      } else {
        return interaction.editReply({ content: "❌ **عذراً أيها الملك! لم يتم تحديد عنوان خادم، ولا يوجد عنوان افتراضي مسجل لهذا السيرفر.**" });
      }
    }

    try {
      const response = await axios.get(`https://api.mcsrvstat.us/3/${ip}`);
      const data = response.data;

      if (!data.online) {
        return interaction.editReply({ content: `❌ **عذراً أيها الملك! الخادم \`${ip}\` غير متصل حالياً.**` });
      }

      const embed = new EmbedBuilder()
        .setAuthor({ name: 'ProMcBot | Minecraft Royal Status', iconURL: client.user.displayAvatarURL() })
        .setTitle(`🏰 **إحصائيات الخادم الملكي**`)
        .setThumbnail(`https://api.mcsrvstat.us/icon/${ip}`)
        .setColor("#D4AF37") // Royal Gold
        .setDescription(`✨ **إليك المعلومات الكاملة عن الخادم المختار:**\n\n` +
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

      await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
      await interaction.editReply({ content: `❌ **حدث خطأ أثناء محاولة جلب بيانات الخادم. تأكد من صحة العنوان.**` });
    }
  },
};
