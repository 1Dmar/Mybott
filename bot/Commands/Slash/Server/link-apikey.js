const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const ApiKey = require('../../../Models/apiKey');
const db = require('pro.db');

module.exports = {
    name: 'link-apikey',
    description: 'Links an API Key to the server.',
    userPermissions: PermissionFlagsBits.Administrator,
    botPermissions: PermissionFlagsBits.SendMessages,
    category: "Server",
    type1: "slash",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'apikey',
            description: 'The API Key to link',
            type: 3,
            required: true,
        }
    ],
    run: async (client, interaction, args) => {
        const apiKey = interaction.options.getString('apikey');

        if (!apiKey || !apiKey.startsWith('promc.')) {
            return interaction.reply('Please provide a valid API Key.');
        }

        const authCode = apiKey.split('promc.')[1];
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply('This command can only be used in a server.');
        }
        const guildId = guild.id;
        
        const storedApiKey = await db.get(guildId);

        if (!storedApiKey || storedApiKey !== authCode) {
            return interaction.reply('Invalid or expired API Key.');
        }

        try {
            let apiKeyRecord = await ApiKey.findOne({ guildId });
            if (apiKeyRecord) {
                apiKeyRecord.authCode = authCode;
            } else {
                apiKeyRecord = new ApiKey({ guildId, authCode });
            }

            await apiKeyRecord.save();
            db.delete(guildId);
            await interaction.reply('The API Key has been successfully linked to your server.');
        } catch (err) {
            console.error('Error linking API key:', err);
            await interaction.reply('An error occurred while linking the API key.');
        }
    },
};
