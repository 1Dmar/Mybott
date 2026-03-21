const {
    ApplicationCommandType,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");
const GuildSettings = require("../../../Models/GuildSettings");

module.exports = {
    name: "automod-log",
    description: "Set the channel for auto-moderation logs",
    userPermissions: PermissionFlagsBits.Administrator,
    botPermissions: PermissionFlagsBits.SendMessages,
    category: "AutoMod",
    type1: "slash",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: "channel",
            description: "The channel to send logs to",
            type: 7, // CHANNEL
            required: true
        }
    ],

    run: async (client, interaction) => {
        const channel = interaction.options.getChannel("channel");

        try {
            const settings = await GuildSettings.getSettings(interaction.guild.id);
            settings.automod.logChannel = channel.id;
            await settings.save();

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle("📋 Log Channel Set")
                .setDescription(`Auto-moderation logs will now be sent to <#${channel.id}>`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: "❌ An error occurred while updating the log channel.",
                ephemeral: true
            });
        }
    }
};
