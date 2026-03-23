const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
  Client,
} = require("discord.js");

module.exports = {
  name: "help",
  description: "عرض قائمة المساعدة والأوامر المتاحة",
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Misc",
  type1: "slash",
  type: ApplicationCommandType.ChatInput,
  /**
   *
   * @param {Client} client
   * @param {CommandInteraction} interaction
   */
  run: async (client, interaction) => {
    const embed = new EmbedBuilder()
      .setColor("#2B2D31")
      .setAuthor({ name: "قائمة المساعدة - ProMcBot", iconURL: client.user.displayAvatarURL() })
      .setTitle("🛡️ مساعد سيرفرات ماينكرافت والديسكورد")
      .setURL("https://discord.com/oauth2/authorize?client_id=1220005260857311294&permissions=537250992&integration_type=0&scope=bot+applications.commands")
      .setDescription(
        "يوفر **ProMcBot** طريقة سهلة لربط سيرفر ماينكرافت الخاص بك بالديسكورد. يمكنك عرض معلومات السيرفر والتحكم بها بضغطة زر واحدة.\n\n" +
        "### 🛠️ الأوامر الأساسية:\n" +
        "> **/setup_server**\n" +
        "> لإعداد سيرفر ماينكرافت عن طريق اختيار نوع السيرفر من القائمة.\n\n" +
        "> **/remove_server**\n" +
        "> لتعطيل الربط وإزالة بيانات السيرفر من البوت.\n\n" +
        "> **/automod-settings**\n" +
        "> لعرض إعدادات الحماية التلقائية الحالية.\n\n" +
        "### 🔗 روابط مفيدة:\n" +
        "• [الدعم الفني](https://discord.gg/6FjFYStz5a)\n" +
        "• [دعوة البوت](https://discord.com/oauth2/authorize?client_id=1220005260857311294&permissions=537250992&integration_type=0&scope=bot+applications.commands)"
      )
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: "تم التطوير بواسطة 1Dmar", iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
