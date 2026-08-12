const UserProfile = require('../Models/UserProfile');
const Server = require('../Models/Server');

/**
 * Engagement & Rewards System
 * Handles economy, leveling, and rewards based on Minecraft activity.
 */
class EngagementSystem {
    constructor(client) {
        this.client = client;
    }

    /**
     * Add experience or currency to a user
     */
    async addReward(userId, guildId, amount, type = 'xp') {
        try {
            let profile = await UserProfile.findOne({ userId, guildId });
            if (!profile) {
                profile = new UserProfile({ userId, guildId });
            }

            if (type === 'xp') {
                profile.xp = (profile.xp || 0) + amount;
                // Simple level up logic: level = floor(sqrt(xp/100))
                const newLevel = Math.floor(Math.sqrt(profile.xp / 100));
                if (newLevel > (profile.level || 0)) {
                    profile.level = newLevel;
                    this.announceLevelUp(userId, guildId, newLevel);
                }
            } else if (type === 'coins') {
                profile.coins = (profile.coins || 0) + amount;
            }

            await profile.save();
            return profile;
        } catch (error) {
            console.error(`[Engagement] Error adding reward:`, error.message);
        }
    }

    /**
     * Announce level up in the server
     */
    async announceLevelUp(userId, guildId, level) {
        // Logic to find a suitable channel and send a message
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return;

        // Implementation would look for a 'logs' or 'general' channel
    }

    /**
     * Get top players for a guild
     */
    async getLeaderboard(guildId, type = 'xp', limit = 10) {
        return await UserProfile.find({ guildId })
            .sort({ [type]: -1 })
            .limit(limit)
            .lean();
    }
}

module.exports = EngagementSystem;
