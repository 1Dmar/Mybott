const axios = require('axios');
const Server = require('../Models/Server');

/**
 * Remote Console System
 * Allows server owners to execute commands and view logs via Discord/Dashboard.
 */
class RemoteConsole {
    constructor(client) {
        this.client = client;
    }

    /**
     * Execute a command on the Minecraft server
     * Requires the ProMcBot Minecraft Plugin to be installed on the server.
     */
    async execute(guildId, command, executorTag) {
        try {
            const server = await Server.findOne({ serverId: guildId });
            if (!server || !server.apiUrl || !server.apiToken) {
                throw new Error('API_NOT_CONFIGURED');
            }

            const endpoint = `${server.apiUrl}/execute`;
            const response = await axios.post(endpoint, {
                command: command,
                executor: executorTag
            }, {
                headers: {
                    'Authorization': `Bearer ${server.apiToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            return {
                success: true,
                output: response.data.output || 'Command executed successfully.',
                timestamp: new Date()
            };

        } catch (error) {
            console.error(`[RemoteConsole] Error in ${guildId}:`, error.message);
            return {
                success: false,
                error: error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Fetch recent logs from the Minecraft server
     */
    async getLogs(guildId, limit = 50) {
        try {
            const server = await Server.findOne({ serverId: guildId });
            if (!server || !server.apiUrl || !server.apiToken) {
                throw new Error('API_NOT_CONFIGURED');
            }

            const endpoint = `${server.apiUrl}/logs?limit=${limit}`;
            const response = await axios.get(endpoint, {
                headers: { 'Authorization': `Bearer ${server.apiToken}` },
                timeout: 8000
            });

            return response.data.logs || [];
        } catch (error) {
            return [];
        }
    }
}

module.exports = RemoteConsole;
