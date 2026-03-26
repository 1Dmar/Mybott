const {
    ApplicationCommandType,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");
const GuildSettings = require("../../../Models/GuildSettings");

module.exports = {
    name: "automod-whitelist",
    description: "Manage whitelist (roles/channels/users)",
    userPermissions: PermissionFlagsBits.Administrator,
    botPermissions: PermissionFlagsBits.SendMessages,
    category: "AutoMod",
    type1: "slash",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: "type",
            description: "What to whitelist",
            type: 3, // STRING
            required: true,
            choices: [
                { name: `${client.emojis.USER} User`, value: "user" },
                { name: `${client.emojis.TAG} Role`, value: "role" },
                { name: `${client.emojis.TV} Channel`, value: "channel" }
            ]
        },
        {
            name: "target",
            description: "User/Role/Channel to whitelist",
            type: 9, // MENTIONABLE (covers user and role)
            required: false
        },
        {
            name: "channel",
            description: "Channel to whitelist (if type is channel)",
            type: 7, // CHANNEL
            required: false
        }
    ],

    run: async (client, interaction) => {
        const type = interaction.options.getString("type");
        const target = interaction.options.getMentionable("target");
        const channel = interaction.options.getChannel("channel");

        try {
            const settings = await GuildSettings.getSettings(interaction.guild.id);
            
            let targetId, targetName;

            if (type === "channel") {
                if (!channel) return interaction.reply({ content: `${client.emojis.ERROR} Please specify a channel.`, ephemeral: true });
                targetId = channel.id;
                targetName = channel.name;
                
                const index = settings.whitelist.channels.indexOf(targetId);
                if (index > -1) {
                    settings.whitelist.channels.splice(index, 1);
                    await settings.save();
                    return interaction.reply(`${client.emojis.SUCCESS} Removed channel **${targetName}** from whitelist.`);
                } else {
                    settings.whitelist.channels.push(targetId);
                    await settings.save();
                    return interaction.reply(`${client.emojis.SUCCESS} Added channel **${targetName}** to whitelist.`);
                }
            } else {
                if (!target) return interaction.reply({ content: `${client.emojis.ERROR} Please specify a target.`, ephemeral: true });
                targetId = target.id;
                targetName = target.name || target.user?.tag;

                const listType = type === "user" ? "users" : "roles";
                const index = settings.whitelist[listType].indexOf(targetId);
                
                if (index > -1) {
                    settings.whitelist[listType].splice(index, 1);
                    await settings.save();
                    return interaction.reply(`${client.emojis.SUCCESS} Removed **${targetName}** from whitelist.`);
                } else {
                    settings.whitelist[listType].push(targetId);
                    await settings.save();
                    return interaction.reply(`${client.emojis.SUCCESS} Added **${targetName}** to whitelist.`);
                }
            }

        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: `${client.emojis.ERROR} An error occurred while updating whitelist.`,
                ephemeral: true
            });
        }
    }
};
