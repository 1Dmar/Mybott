const {
    ApplicationCommandType,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");
const GuildSettings = require('../../../Models/GuildSettings');
const { normalizeAutomod } = require('../../../../dash/moderationConfig');
const { requireProModeration } = require('../../../utils/moderationGate');
const EMOJI_CONFIG = require('../../../settings/emojis');

function formatEmoji(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value.id) return `<${value.animated ? 'a' : ''}:emoji:${value.id}>`;
    return '';
}

const emoji = name => formatEmoji(EMOJI_CONFIG[name]);

module.exports = {
    name: "automod-settings",
    description: "عرض إعدادات الحماية التلقائية الحالية",
    userPermissions: PermissionFlagsBits.Administrator,
    botPermissions: PermissionFlagsBits.SendMessages,
    category: "AutoMod",
    type1: "slash",
    type: ApplicationCommandType.ChatInput,

    run: async (client, interaction) => {
        const gate = await requireProModeration(interaction);
        if (!gate.ok) return interaction.reply(gate.response);
        try {
            const settings = await GuildSettings.getSettings(interaction.guild.id);
            const automod = normalizeAutomod(settings?.automod);
            const emojis = (bool) => bool ? emoji('SUCCESS') : emoji('ERROR');

            const embed = new EmbedBuilder()
                .setColor(0x2B2D31)
                .setAuthor({ name: `إعدادات الحماية - ${interaction.guild.name}`, iconURL: interaction.guild.iconURL() })
                .setTitle(`${emoji('SHIELD')} لوحة تحكم الحماية التلقائية`)
                .setDescription(`حالة النظام الحالية: ${automod.enabled ? `${emoji('ONLINE')} **مفعل**` : `${emoji('OFFLINE')} **معطل**`}`)
                .addFields(
                    {
                        name: `${emoji('SEARCH')} الفلاتر النشطة`,
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
                        name: `${emoji('GEAR')} الحدود والقيود`,
                        value: [
                            `> 🔠 نسبة الكابس: \`${automod.limits.capsPercentage}%\``,
                            `> ✉️ حد السبام: \`${automod.limits.spamCount}\` رسائل`,
                            `> ⏱️ مدة الفحص: \`${automod.limits.spamInterval / 1000}s\``,
                            `> ${emoji('USER')} حد المنشن: \`${automod.limits.maxMentions}\``,
                        ].join("\n"),
                        inline: true
                    },
                    {
                        name: `${emoji('WRENCH')} التكوين الحالي`,
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
                content: `${emoji('ERROR')} حدث خطأ أثناء جلب الإعدادات.`,
                ephemeral: true
            });
        }
    }
};
