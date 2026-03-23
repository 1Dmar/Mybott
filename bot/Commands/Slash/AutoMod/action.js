const {
    ApplicationCommandType,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");
const GuildSettings = require("../../../Models/GuildSettings");

module.exports = {
    name: "automod-action",
    description: "تحديد نوع العقوبة عند حدوث مخالفة",
    userPermissions: PermissionFlagsBits.Administrator,
    botPermissions: PermissionFlagsBits.SendMessages,
    category: "AutoMod",
    type1: "slash",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: "type",
            description: "اختر نوع العقوبة",
            type: 3, // STRING
            required: true,
            choices: [
                { name: "${client.emojis.DELETE} حذف فقط", value: "delete" },
                { name: "${client.emojis.WARNING}️ حذف + تحذير", value: "warn" },
                { name: "🔇 إسكات (ساعة واحدة)", value: "timeout" },
                { name: "👢 طرد", value: "kick" },
                { name: "${client.emojis.HAMMER} حظر نهائي", value: "ban" }
            ]
        }
    ],

    run: async (client, interaction) => {
        const action = interaction.options.getString("type");

        try {
            const settings = await GuildSettings.getSettings(interaction.guild.id);
            settings.automod.action = action;
            await settings.save();

            const actionDescriptions = {
                delete: "سيتم حذف الرسالة فقط دون اتخاذ إجراء إضافي.",
                warn: "سيتم حذف الرسالة وإرسال تحذير للمستخدم في الخاص.",
                timeout: "سيتم حذف الرسالة وإسكات المستخدم لمدة ساعة واحدة.",
                kick: "سيتم حذف الرسالة وطرد المستخدم من السيرفر.",
                ban: "سيتم حذف الرسالة وحظر المستخدم نهائياً من السيرفر."
            };

            const embed = new EmbedBuilder()
                .setColor(0x2B2D31)
                .setAuthor({ name: "إعدادات العقوبات", iconURL: interaction.guild.iconURL() })
                .setTitle("⚡ تم تحديث نوع العقوبة")
                .setDescription(`تم ضبط العقوبة التلقائية لتكون: **${action.toUpperCase()}**`)
                .addFields(
                    { name: "${client.emojis.EDIT} وصف الإجراء:", value: `> ${actionDescriptions[action]}` }
                )
                .setFooter({ text: "نظام الحماية التلقائي", iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: "${client.emojis.ERROR} حدث خطأ أثناء تحديث نوع العقوبة.",
                ephemeral: true
            });
        }
    }
};
