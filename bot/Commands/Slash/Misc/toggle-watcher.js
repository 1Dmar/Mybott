const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const Server = require("../../../Models/Server");

module.exports = {
  name: "toggle-watcher",
  description: "👑 تشغيل أو إيقاف مراقب ماين كرافت التلقائي في السيرفر",
  userPermissions: PermissionFlagsBits.ManageGuild,
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: true });

    try {
      let serverData = await Server.findOne({ serverId: interaction.guild.id });

      if (!serverData) {
        serverData = new Server({
          serverId: interaction.guild.id,
          serverName: interaction.guild.name,
          watcherEnabled: false
        });
      }

      // Toggle the status
      serverData.watcherEnabled = !serverData.watcherEnabled;
      await serverData.save();

      const status = serverData.watcherEnabled ? "مفعل ✅" : "معطل ❌";
      const color = serverData.watcherEnabled ? "#00FF00" : "#FF0000";

      const embed = new EmbedBuilder()
        .setTitle("👑 نظام المراقبة الملكي")
        .setDescription(`✨ **تم تحديث حالة مراقب ماين كرافت التلقائي في السيرفر.**\n\n🔱 **الحالة الحالية:** \`${status}\``)
        .setColor(color)
        .setFooter({ text: "نظام التحكم الملكي | ProMcBot", iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: "❌ **حدث خطأ أثناء محاولة تحديث الإعدادات في قاعدة البيانات.**" });
    }
  },
};
