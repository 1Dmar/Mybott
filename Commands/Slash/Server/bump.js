const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const ApiKey = require('../../../Models/apiKey');
const BumpedServer = require('../../../Models/bumpedServer');
const bumpCooldown = new Map();
const COOLDOWN_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

module.exports = {
    name: 'bump',
    description: 'Bumps the server.',
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

        if (bumpCooldown.has(guildId)) {
            const expirationTime = bumpCooldown.get(guildId) + COOLDOWN_DURATION;
            if (Date.now() < expirationTime) {
                const timeLeft = (expirationTime - Date.now()) / 1000;
                const hours = Math.floor(timeLeft / 3600);
                const minutes = Math.floor((timeLeft % 3600) / 60);
                const seconds = Math.floor(timeLeft % 60);
                return interaction.reply(`You need to wait ${hours} hours, ${minutes} minutes, and ${seconds} seconds before bumping again.`);
            }
        }

        try {
            const apiKey = await ApiKey.findOne({ guildId });

            if (!apiKey) {
                return interaction.reply('API Key not found or not linked. Please link an API Key first.');
            }

            const bumpedServer = new BumpedServer({
                guildId: guildId,
                bumpedAt: new Date(),
            });

            await bumpedServer.save();
            bumpCooldown.set(guildId, Date.now());
            await interaction.reply('Server bumped successfully!');
        } catch (err) {
            console.error('Error bumping server:', err);
            await interaction.reply('An error occurred while bumping the server.');
        }
    },
};
