const {
    ApplicationCommandType,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");
const GuildSettings = require("../../../Models/GuildSettings");

module.exports = {
    name: "automod-action",
    description: "Set the punishment action for violations",
    userPermissions: PermissionFlagsBits.Administrator,
    botPermissions: PermissionFlagsBits.SendMessages,
    category: "AutoMod",
    type1: "slash",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: "type",
            description: "Select punishment type",
            type: 3, // STRING
            required: true,
            choices: [
                { name: "🗑️ Delete Only", value: "delete" },
                { name: "⚠️ Delete + Warn", value: "warn" },
                { name: "🔇 Timeout (1 hour)", value: "timeout" },
                { name: "👢 Kick", value: "kick" },
                { name: "🔨 Ban", value: "ban" }
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
                delete: "Message will be deleted, no additional punishment",
                warn: "Message deleted + Warning DM sent",
                timeout: "Message deleted + 1 hour timeout",
                kick: "Message deleted + User kicked",
                ban: "Message deleted + User banned"
            };

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle("⚡ Punishment Action Set")
                .setDescription(`Action: **${action.toUpperCase()}**`)
                .addFields(
                    { name: "Description", value: actionDescriptions[action] }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: "❌ An error occurred while updating the action.",
                ephemeral: true
            });
        }
    }
};
