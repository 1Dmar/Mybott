const {
    ApplicationCommandType,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");
const GuildSettings = require("../../../Models/GuildSettings");

module.exports = {
    name: "automod-settings",
    description: "عرض إعدادات الحماية التلقائية الحالية",
    userPermissions: PermissionFlagsBits.Administrator,
    botPermissions: PermissionFlagsBits.SendMessages,
    category: "AutoMod",
    type1: "slash",
    type: ApplicationCommandType.ChatInput,

    run: async (client, interaction) => {
        try {
            const settings = await GuildSettings.getSettings(interaction.guild.id);
            const { automod } = settings;
            const emojis = (bool) => bool ? client.emojis.SUCCESS : client.emojis.ERROR;

            const embed = new EmbedBuilder()
                .setColor(0x2B2D31)
                .setAuthor({ name: `إعدادات الحماية - ${interaction.guild.name}`, iconURL: interaction.guild.iconURL() })
                .setTitle(`${client.emojis.SHIELD} لوحة تحكم الحماية التلقائية`)
                .setDescription(`حالة النظام الحالية: ${automod.enabled ? `${client.emojis.ONLINE} **مفعل**` : `${client.emojis.OFFLINE} **معطل**`}`)
                .addFields(
                    {
                        name: `${client.emojis.SEARCH} الفلاتر النشطة`,
                        value: [
                            `> ${emojis(automod.filters.badwords)} الكلمات النابية`,
                            `> ${emojis(automod.filters.caps)} الأحرف الكبيرة`,
                            `> ${emojis(automod.filters.spam)} السبام (العشوائية)`,
                            `> ${emojis(automod.filters.invites)} روابط الدعوة`,
                            `> ${emojis(automod.filters.links)} الروابط الخارجية`,
                            `> ${emojis(automod.filters.mentions)} المنشن المفرط`
                        ].join("\n"),
                        inline: true
                    },
                    {
                        name: `${client.emojis.GEAR} الحدود والقيود`,
                        value: [
                            `> 🔠 نسبة الكابس: \`${automod.limits.capsPercentage}%\``,
                            `> ✉️ حد السبام: \`${automod.limits.spamCount}\` رسائل`,
                            `> ⏱️ مدة الفحص: \`${automod.limits.spamInterval / 1000}s\``,
                            `> ${client.emojis.USER} حد المنشن: \`${automod.limits.maxMentions}\``
                        ].join("\n"),
                        inline: true
                    },
                    {
                        name: `${client.emojis.WRENCH} التكوين الحالي`,
                        value: [
                            `> 🛠️ الإجراء المتخذ: \`${automod.action.toUpperCase()}\``,
                            `> 📜 قناة السجلات: ${automod.logChannel ? `<#${automod.logChannel}>` : "`غير محددة`"}`
                        ].join("\n"),
                        inline: false
                    }
                )
                .setFooter({ text: "يمكنك تعديل هذه الإعدادات باستخدام أوامر /automod", iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: `${client.emojis.ERROR} حدث خطأ أثناء جلب الإعدادات.`,
                ephemeral: true
            });
        }
    }
};
