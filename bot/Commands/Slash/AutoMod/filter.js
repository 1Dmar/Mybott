const {
    ApplicationCommandType,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");
const GuildSettings = require("../../../Models/GuildSettings");

module.exports = {
    name: "automod-filter",
    description: "Toggle specific auto-mod filters",
    userPermissions: PermissionFlagsBits.Administrator,
    botPermissions: PermissionFlagsBits.SendMessages,
    category: "AutoMod",
    type1: "slash",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: "type",
            description: "Select the filter to toggle",
            type: 3, // STRING
            required: true,
            choices: [
                { name: "🔤 Bad Words", value: "badwords" },
                { name: "🔠 Caps Lock", value: "caps" },
                { name: "${client.emojis.ANNOUNCEMENT} Spam Detection", value: "spam" },
                { name: "${client.emojis.LINK} Invite Links", value: "invites" },
                { name: "${client.emojis.GLOBAL} All Links", value: "links" },
                { name: "${client.emojis.MEMBERS} Mention Spam", value: "mentions" }
            ]
        },
        {
            name: "enabled",
            description: "Enable or disable this filter",
            type: 5, // BOOLEAN
            required: true
        }
    ],

    run: async (client, interaction) => {
        const filterType = interaction.options.getString("type");
        const enabled = interaction.options.getBoolean("enabled");

        try {
            const settings = await GuildSettings.getSettings(interaction.guild.id);
            
            if (!settings.automod.filters.hasOwnProperty(filterType)) {
                return interaction.reply({
                    content: "${client.emojis.ERROR} Invalid filter type.",
                    ephemeral: true
                });
            }

            settings.automod.filters[filterType] = enabled;
            await settings.save();

            const filterNames = {
                badwords: "Bad Words Filter",
                caps: "Caps Lock Filter",
                spam: "Spam Detection",
                invites: "Invite Link Blocker",
                links: "External Link Blocker",
                mentions: "Mention Spam Protection"
            };

            const embed = new EmbedBuilder()
                .setColor(enabled ? 0x00FF00 : 0xFF0000)
                .setTitle("${client.emojis.SHIELD} Filter Updated")
                .setDescription(`${filterNames[filterType]} is now **${enabled ? "ENABLED" : "DISABLED"}**`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: "${client.emojis.ERROR} An error occurred while updating the filter.",
                ephemeral: true
            });
        }
    }
};
