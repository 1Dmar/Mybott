const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const ApiKey = require('../../../Models/apiKey');
const db = require('pro.db');

module.exports = {
    name: 'generate-apikey',
    description: 'Generates an API Key for the server.',
    userPermissions: PermissionFlagsBits.SendMessages,
    botPermissions: PermissionFlagsBits.SendMessages,
    category: "Server",
    type1: "slash",
    type: ApplicationCommandType.ChatInput,
    run: async (client, interaction, args) => {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply('This command can only be used in a server.');
        }
        const guildId = guild.id;
        const authCode = generateApiKey();

        try {
            let apiKey = await ApiKey.findOne({ guildId });
            if (apiKey) {
                apiKey.authCode = authCode;
            } else {
                apiKey = new ApiKey({ guildId, authCode });
            }

            await apiKey.save();
            await interaction.user.send(`Your API Key is: \`promc.${authCode}\``);

            // Save the code in temporary database for a certain period
            db.set(guildId, authCode, { ttl: 43200 }); // 12 hours
            
            await interaction.reply('The API Key has been generated and sent to your DMs.');
        } catch (err) {
            console.error('Error generating API key:', err);
            await interaction.reply('An error occurred while generating the API key.');
        }
    },
};

function generateApiKey() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let apiKey = '';
    for (let i = 0; i < 32; i++) {
        apiKey += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return apiKey;
}
