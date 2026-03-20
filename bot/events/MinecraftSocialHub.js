const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const Server = require("../Models/Server");

module.exports = {
  name: "messageCreate",
  execute: async (message) => {
    if (!message || !message.author || message.author.bot || !message.guild) return;

    // Check if social hub is enabled for this server in MongoDB
    const serverData = await Server.findOne({ serverId: message.guild.id });
    if (!serverData || !serverData.watcherEnabled) return; // Reuse watcherEnabled for simplicity or add socialHubEnabled

    const content = message.content.toLowerCase();
    const client = message.client;

    // --- 1. Looking For Group (LFG) System ---
    const lfgKeywords = ["أبحث عن", "مين يلعب", "سكايبلوك", "هايبكسل", "بدوارز", "حرب البيض", "lfg", "anyone play", "play with me", "hypixel", "bedwars", "skyblock"];
    if (lfgKeywords.some(key => content.includes(key))) {
      const lfgEmbed = new EmbedBuilder()
        .setAuthor({ name: 'ProMcBot | Minecraft Social Hub', iconURL: client.user.displayAvatarURL() })
        .setTitle(`🏰 **دعوة انضمام ملكية للعب!**`)
        .setColor("#D4AF37")
        .setDescription(`✨ **أهلاً بك أيها اللاعب! لقد رصدنا أنك تبحث عن شركاء للعب.**\n\n👤 **الداعي:** <@${message.author.id}>\n🎮 **الرسالة:** \`${message.content}\`\n\n🔱 **اضغط على الزر أدناه لتأكيد رغبتك في الانضمام إليه!**`)
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ text: "نظام التواصل الملكي | ProMcBot", iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      const lfgRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`join_lfg_${message.author.id}`)
            .setLabel('أريد الانضمام ⚔️')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setLabel('دعم البوت')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.gg/1Dmar')
        );

      return message.reply({ embeds: [lfgEmbed], components: [lfgRow] });
    }

    // --- 2. Achievement Showcase System ---
    const achievementKeywords = ["فزت", "جمعت", "قتلت", "أنهيت", "won", "killed", "collected", "finished", "achievement", "إنجاز"];
    if (achievementKeywords.some(key => content.includes(key)) && (content.includes("diamond") || content.includes("دايموند") || content.includes("boss") || content.includes("بوس") || content.includes("game") || content.includes("مباراة"))) {
      const achievementEmbed = new EmbedBuilder()
        .setAuthor({ name: 'ProMcBot | Achievement Showcase', iconURL: client.user.displayAvatarURL() })
        .setTitle(`👑 **إنجاز ملكي جديد!**`)
        .setColor("#FFD700")
        .setDescription(`🎊 **تهانينا أيها البطل! لقد تم تسجيل إنجاز جديد في سيرفرنا.**\n\n🎖️ **اللاعب:** <@${message.author.id}>\n📜 **الإنجاز:** \`${message.content}\`\n\n✨ **استمر في هذا التألق الملكي!**`)
        .setThumbnail("https://i.imgur.com/vS3v2u6.png") // Generic trophy icon
        .setFooter({ text: "نظام التميز الملكي | ProMcBot", iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      return message.reply({ embeds: [achievementEmbed] });
    }
  },
};
