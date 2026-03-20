const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const axios = require("axios");

module.exports = {
  name: "mcstatus",
  description: "👑 الحصول على حالة خادم ماين كرافت بتصميم ملكي",
  options: [
    {
      name: "ip",
      description: "عنوان خادم ماين كرافت (مثال: play.hypixel.net)",
      type: 3, // STRING type
      required: true
    }
  ],
  
  run: async (client, interaction) => {
    const ip = interaction.options.getString("ip");
    await interaction.deferReply();

    try {
      const response = await axios.get(`https://api.mcsrvstat.us/3/${ip}`);
      const data = response.data;

      if (!data.online) {
        return interaction.editReply({ content: `❌ **عذراً أيها الملك! الخادم \`${ip}\` غير متصل حالياً.**` });
      }

      const embed = new EmbedBuilder()
        .setAuthor({ name: 'ProMcBot | Minecraft Royal Status', iconURL: client.user.displayAvatarURL() })
        .setTitle(`🏰 **تفاصيل الخادم الملكي: ${ip}**`)
        .setThumbnail(`https://api.mcsrvstat.us/icon/${ip}`)
        .setColor("#D4AF37")
        .setDescription(`✨ **إليك المعلومات الكاملة عن الخادم الذي طلبته:**\n\n` +
                        `🔱 **اسم الخادم:** \`${data.hostname || ip}\`\n` +
                        `💎 **الإصدار:** \`${data.version || "غير معروف"}\`\n` +
                        `👥 **اللاعبين:** \`${data.players.online}/${data.players.max}\`\n` +
                        `📶 **الحالة:** \`متصل ✅\``)
        .addFields(
          { name: '📜 وصف الخادم', value: `\`\`\`${data.motd?.clean?.join('\n') || 'لا يوجد وصف متاح'}\`\`\`` },
          { name: '🛠️ النوع', value: `\`${data.software || 'Vanilla'}\``, inline: true },
          { name: '📍 العنوان الكامل', value: `\`${ip}\``, inline: true }
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
