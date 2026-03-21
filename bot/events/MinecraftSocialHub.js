const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const Server = require("../Models/Server");

module.exports = {
  name: "messageCreate",
  execute: async (message) => {
    try {
      if (!message || !message.author || message.author.bot || !message.guild) return;

      const serverData = await Server.findOne({ serverId: message.guild.id });
      if (!serverData || !serverData.watcherEnabled) return;

      const content = message.content.toLowerCase();
      const client = message.client;

      // 1. LFG
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

      // 2. Achievements
      const achievementKeywords = ["فزت", "جمعت", "قتلت", "أنهيت", "won", "killed", "collected", "finished", "achievement", "إنجاز"];
      if (achievementKeywords.some(key => content.includes(key)) && (content.includes("diamond") || content.includes("دايموند") || content.includes("boss") || content.includes("بوس") || content.includes("game") || content.includes("مباراة"))) {
        const achievementEmbed = new EmbedBuilder()
          .setAuthor({ name: 'ProMcBot | Achievement Showcase', iconURL: client.user.displayAvatarURL() })
          .setTitle(`👑 **إنجاز ملكي جديد!**`)
          .setColor("#FFD700")
          .setDescription(`🎊 **تهانينا أيها البطل! لقد تم تسجيل إنجاز جديد في سيرفرنا.**\n\n🎖️ **اللاعب:** <@${message.author.id}>\n📜 **الإنجاز:** \`${message.content}\`\n\n✨ **استمر في هذا التألق الملكي!**`)
          .setThumbnail("https://i.imgur.com/vS3v2u6.png")
          .setFooter({ text: "نظام التميز الملكي | ProMcBot", iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        return message.reply({ embeds: [achievementEmbed] });
      }

      // 3. Challenges
      if (Math.random() < 0.05) {
        const mcQuestions = [
          { q: "ما هو العنصر المستخدم لصناعة البوصلة؟", a: ["ريدستون", "redstone"] },
          { q: "كم عدد القلوب التي يمتلكها التنين (Ender Dragon)؟", a: ["200", "100 قلب", "100 hearts"] },
          { q: "ما هو البلوك الذي لا يمكن كسرها في وضع الـ Survival؟", a: ["بيدروك", "bedrock"] },
          { q: "أي حيوان يمكنه الطيران في ماين كرافت؟", a: ["الببغاء", "parrot"] }
        ];
        const challenge = mcQuestions[Math.floor(Math.random() * mcQuestions.length)];
        const challengeEmbed = new EmbedBuilder()
          .setAuthor({ name: 'ProMcBot | Royal Quick Challenge', iconURL: client.user.displayAvatarURL() })
          .setTitle(`⚡ **تحدي ملكي سريع!**`)
          .setColor("#FF4500")
          .setDescription(`👑 **أول من يجيب على هذا السؤال يفوز بوسام ملكي مؤقت!**\n\n❓ **السؤال:** \`${challenge.q}\`\n\n🔱 **اكتب الإجابة الآن في الشات!**`)
          .setFooter({ text: "نظام التحديات الملكي | ProMcBot", iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        const filter = m => challenge.a.some(ans => m.content.toLowerCase().includes(ans));
        const collector = message.channel.createMessageCollector({ filter, time: 15000, max: 1 });
        message.channel.send({ embeds: [challengeEmbed] });
        collector.on('collect', m => {
          const winnerEmbed = new EmbedBuilder()
            .setAuthor({ name: 'ProMcBot | Royal Winner', iconURL: client.user.displayAvatarURL() })
            .setTitle(`🎊 **فائز ملكي جديد!**`)
            .setColor("#32CD32")
            .setDescription(`🎖️ **تهانينا أيها البطل <@${m.author.id}>!**\n\n✅ **الإجابة الصحيحة كانت:** \`${challenge.a[0]}\`\n\n✨ **لقد حصلت على وسام التميز الملكي لهذا اليوم!**`)
            .setThumbnail(m.author.displayAvatarURL())
            .setTimestamp();
          m.reply({ embeds: [winnerEmbed] });
        });
      }
    } catch (err) {
      console.error("Error in MinecraftSocialHub:", err);
    }
  },
};
