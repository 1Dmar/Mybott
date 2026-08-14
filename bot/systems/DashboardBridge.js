/**
 * DashboardBridge — الجسر الحقيقي بين داشبورد ProMcBot والبوت.
 *
 * يقوم بقراءة الإعدادات التي يحفظها المالك من الداشبورد إلى MongoDB
 * (BotConfig, GuildSettings) ويوفر واجهة موحدة لجميع أنظمة البوت.
 *
 * الداشبورد يكتب ← MongoDB ← البوت يقرأ ويطبق فوراً.
 */
'use strict';

// Cache layer: settings are read frequently, write rarely.
const cache = new Map();
const CACHE_TTL_MS = 60_000; // 1 minute

class DashboardBridge {
    constructor(client) {
        this.client = client;
    }

    /**
     * Fetch BotConfig for a guild with caching.
     * BotConfig schema fields: nickname, description, premiumTier, status,
     * modules{autoResponder, welcomeMessages, moderation, logs, tickets, serverStatus},
     * welcome{channelId, message, embedColor, enabled}, ticket{...}, minecraft{...}
     */
    async getBotConfig(guildId) {
        if (!guildId) return null;
        const now = Date.now();
        const cached = cache.get(`botconfig:${guildId}`);
        if (cached && now - cached.at < CACHE_TTL_MS) return cached.value;

        try {
            const BotConfig = require('../Models/BotConfig');
            const config = await BotConfig.findOne({ guildId }).lean();
            cache.set(`botconfig:${guildId}`, { value: config, at: now });
            return config;
        } catch (err) {
            console.error('[DashboardBridge] getBotConfig failed:', err.message);
            return null;
        }
    }

    /**
     * Fetch GuildSettings (automod) for a guild with caching.
     */
    async getGuildSettings(guildId) {
        if (!guildId) return null;
        const now = Date.now();
        const cached = cache.get(`guildsettings:${guildId}`);
        if (cached && now - cached.at < CACHE_TTL_MS) return cached.value;

        try {
            const GuildSettings = require('../Models/GuildSettings');
            const settings = await GuildSettings.getSettings(guildId);
            cache.set(`guildsettings:${guildId}`, { value: settings, at: now });
            return settings;
        } catch (err) {
            console.error('[DashboardBridge] getGuildSettings failed:', err.message);
            return null;
        }
    }

    /**
     * Check if a dashboard-controlled module is enabled for a guild.
     * Module keys match BotConfig.modules exactly (same keys the dashboard toggles).
     */
    async isModuleEnabled(guildId, moduleKey) {
        const config = await this.getBotConfig(guildId);
        return Boolean(config?.modules?.[moduleKey]);
    }

    /**
     * Invalidate config cache after a dashboard write.
     * Called by the dashboard API when settings are saved (via custom event or direct call).
     */
    invalidate(guildId) {
        cache.delete(`botconfig:${guildId}`);
        cache.delete(`guildsettings:${guildId}`);
    }

    /**
     * Invalidate ALL caches (e.g. after migration or admin action).
     */
    invalidateAll() {
        cache.clear();
    }
}

module.exports = DashboardBridge;
