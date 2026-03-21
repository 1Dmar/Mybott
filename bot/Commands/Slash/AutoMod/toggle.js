const {
    ApplicationCommandType,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");
const GuildSettings = require("../../../Models/GuildSettings");

module.exports = {
    name: "automod-toggle",
    description: "Enable or disable auto-moderation system",
    userPermissions: PermissionFlagsBits.Administrator,
    botPermissions: PermissionFlagsBits.SendMessages,
    category: "AutoMod",
    type1: "slash",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: "enabled",
            description: "Turn auto-moderation on or off",
            type: 5, // BOOLEAN
            required: true
        }
    ],

    run: async (client, interaction) => {
        const enabled = interaction.options.getBoolean("enabled");
        
        try {
            const settings = await GuildSettings.getSettings(interaction.guild.id);
            settings.automod.enabled = enabled;
            await settings.save();

            const embed = new EmbedBuilder()
                .setColor(enabled ? 0x00FF00 : 0xFF0000)
                .setTitle("🛡️ Auto-Moderation System")
                .setDescription(`Auto-moderation has been **${enabled ? "ENABLED" : "DISABLED"}**`)
                .addFields(
                    { name: "Status", value: enabled ? "🟢 Active" : "🔴 Inactive", inline: true },
                    { name: "Changed By", value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: "❌ An error occurred while updating settings.",
                ephemeral: true
            });
        }
    }
};
