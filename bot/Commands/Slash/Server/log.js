const { ApplicationCommandType, PermissionFlagsBits } = require('discord.js');
const Log = require('../../../Models/Log');

module.exports = {
    name: "setup_log",
    description: "Set up log channels for various log types.",
    userPermissions: PermissionFlagsBits.Administrator,
    botPermissions: PermissionFlagsBits.SendMessages,
    category: "Server",
    type1: "slash",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'log_type',
            description: 'The type of log to set up.',
            type: 3, // STRING type
            required: true,
            choices: [
                { name: 'MessageDelete', value: 'MessageDelete' },
                { name: 'MessageUpdate', value: 'MessageUpdate' },
                { name: 'GuildMemberAdd', value: 'GuildMemberAdd' },
                { name: 'GuildMemberRemove', value: 'GuildMemberRemove' },
                { name: 'RoleCreate', value: 'RoleCreate' },
                { name: 'RoleDelete', value: 'RoleDelete' },
                { name: 'GuildBanAdd', value: 'GuildBanAdd' },
                { name: 'GuildBanRemove', value: 'GuildBanRemove' },
                { name: 'ChannelCreate', value: 'ChannelCreate' },
                { name: 'ChannelDelete', value: 'ChannelDelete' },
                { name: 'EmojiCreate', value: 'EmojiCreate' },
                { name: 'EmojiDelete', value: 'EmojiDelete' },
                { name: 'VoiceStateUpdateJoin', value: 'VoiceStateUpdateJoin' },
                { name: 'VoiceStateUpdateLeave', value: 'VoiceStateUpdateLeave' },
                { name: 'VoiceStateUpdateMove', value: 'VoiceStateUpdateMove' }
            ]
        },
        {
            name: 'channel',
            description: 'The channel to set for the log.',
            type: 7, // CHANNEL type
            required: true
        }
    ],
    run: async (client, interaction) => {
        const logType = interaction.options.getString('log_type');
        const channel = interaction.options.getChannel('channel');

        const logTypes = [
            'MessageDelete', 'MessageUpdate', 'GuildMemberAdd', 'GuildMemberRemove',
            'RoleCreate', 'RoleDelete', 'GuildBanAdd', 'GuildBanRemove',
            'ChannelCreate', 'ChannelDelete', 'EmojiCreate', 'EmojiDelete',
            'VoiceStateUpdateJoin', 'VoiceStateUpdateLeave', 'VoiceStateUpdateMove'
        ];

        if (!logType || !logTypes.includes(logType)) {
            const availableTypes = logTypes.join(', ');
            await interaction.reply(`Please provide a valid log type. Available types are: ${availableTypes}`);
            return;
        }

        if (!channel) {
            await interaction.reply('Please provide a valid channel.');
            return;
        }

        await Log.findOneAndUpdate(
            { serverId: interaction.guild.id },
            { $pull: { logs: { logType } } }, // Remove existing log type if it exists
            { upsert: true }
        );

        await Log.findOneAndUpdate(
            { serverId: interaction.guild.id },
            { $push: { logs: { logType, logChannelId: channel.id } } },
            { upsert: true }
        );

        await interaction.reply(`Log type ${logType} has been set to channel <#${channel.id}>.`);
    }
};
