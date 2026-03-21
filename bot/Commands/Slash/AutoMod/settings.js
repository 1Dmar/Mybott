const {
    ApplicationCommandType,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");
const GuildSettings = require("../../../Models/GuildSettings");

module.exports = {
    name: "automod-settings",
    description: "View current auto-moderation settings",
    userPermissions: PermissionFlagsBits.Administrator,
    botPermissions: PermissionFlagsBits.SendMessages,
    category: "AutoMod",
    type1: "slash",
    type: ApplicationCommandType.ChatInput,

    run: async (client, interaction) => {
        try {
            const settings = await GuildSettings.getSettings(interaction.guild.id);
            const { automod } = settings;
            const emojis = (bool) => bool ? "🟢" : "🔴";

            const embed = new EmbedBuilder()
                .setColor(automod.enabled ? 0x00FF00 : 0xFF0000)
                .setTitle("🛡️ Auto-Moderation Settings")
                .setDescription(`System Status: **${automod.enabled ? "ACTIVE" : "INACTIVE"}**`)
                .addFields(
                    {
                        name: "📋 Filters",
                        value: `
${emojis(automod.filters.badwords)} Bad Words
${emojis(automod.filters.caps)} Caps Lock
${emojis(automod.filters.spam)} Spam Detection
${emojis(automod.filters.invites)} Invite Links
${emojis(automod.filters.links)} All Links
${emojis(automod.filters.mentions)} Mention Spam
                        `,
                        inline: true
                    },
                    {
                        name: "⚙️ Limits",
                        value: `
Caps: ${automod.limits.capsPercentage}%
Spam: ${automod.limits.spamCount} msgs/${automod.limits.spamInterval/1000}s
Mentions: ${automod.limits.maxMentions} max
                        `,
                        inline: true
                    },
                    {
                        name: "🔧 Configuration",
                        value: `
Action: \`${automod.action}\`
Log Channel: ${automod.logChannel ? `<#${automod.logChannel}>` : "Not set"}
                        `,
                        inline: false
                    }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: "❌ An error occurred while fetching settings.",
                ephemeral: true
            });
        }
    }
};
