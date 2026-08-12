const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const Server = require('../Models/Server');
const StatusBar = require('../Models/StatusBar');
const { generateStatusImage } = require('../utils/statusUpdater');

/**
 * Advanced Live Monitoring System for Minecraft Servers
 */
class LiveMonitoring {
    constructor(client) {
        this.client = client;
    }

    /**
     * Update a specific guild's status card
     */
    async updateGuildStatus(guildId) {
        try {
            const [server, settings] = await Promise.all([
                Server.findOne({ serverId: guildId }),
                StatusBar.findOne({ serverId: guildId })
            ]);

            if (!server || !settings || !settings.statusChannelId) return;

            const channel = await this.client.channels.fetch(settings.statusChannelId).catch(() => null);
            if (!channel) return;

            // Fetch live data
            const status = await this.fetchStatus(server);
            
            // Update server model with latest status
            server.isOnline = status.online;
            server.lastStatusCheck = new Date();
            await server.save();

            // Generate the advanced image
            const imageBuffer = await generateStatusImage(server, status);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'server-status.png' });

            // Send or Edit message
            if (settings.statusMessageId) {
                const message = await channel.messages.fetch(settings.statusMessageId).catch(() => null);
                if (message) {
                    await message.edit({ files: [attachment] });
                } else {
                    const newMessage = await channel.send({ files: [attachment] });
                    settings.statusMessageId = newMessage.id;
                    await settings.save();
                }
            } else {
                const newMessage = await channel.send({ files: [attachment] });
                settings.statusMessageId = newMessage.id;
                await settings.save();
            }

        } catch (error) {
            console.error(`[LiveMonitoring] Error updating guild ${guildId}:`, error.message);
        }
    }

    /**
     * Internal status fetcher with multiple fallbacks
     */
    async fetchStatus(server) {
        const ip = server.serverType === 'java' ? server.javaIP : server.bedrockIP;
        const port = server.serverType === 'java' ? server.javaPort : server.bedrockPort;
        const type = server.serverType;

        const url = type === 'java' 
            ? `https://api.mcsrvstat.us/3/${ip}:${port}`
            : `https://api.mcsrvstat.us/bedrock/3/${ip}:${port}`;

        try {
            const response = await axios.get(url, { timeout: 8000 });
            return response.data;
        } catch (error) {
            return { online: false, players: { online: 0, max: 0 }, version: 'N/A' };
        }
    }
}

module.exports = LiveMonitoring;
