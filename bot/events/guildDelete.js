const { Collection } = require('discord.js');
const Server = require('../Models/Server');
const GuildSettings = require('../Models/GuildSettings');
const Langs = require('../Models/Langs');
const Activity = require('../Models/Activity');
const AutoResponder = require('../Models/AutoResponder');
const Mentions = require('../Models/Mentions');
const Log = require('../Models/Log');
const StatusBar = require('../Models/StatusBar');
const UpdateStatus = require('../Models/UpdateStatus');
const WelcomeChannel = require('../Models/WelcomeChannel');
const apiKey = require('../Models/apiKey');
const bumpedServer = require('../Models/bumpedServer');
const BotConfig = require('../Models/BotConfig');

// مجموعة لتخزين المؤقتات (Timers)
const leaveTimers = new Collection();

module.exports = {
    name: 'guildDelete',
    async execute(guild, client) {
        console.log(`[GuildDelete] Bot left/kicked from guild: ${guild.name} (${guild.id})`);

        // بدء مؤقت لمدة 5 دقائق (300,000 مللي ثانية)
        const timer = setTimeout(async () => {
            try {
                // التأكد من أن البوت لم يعد للسيرفر خلال الـ 5 دقائق
                const currentGuild = client.guilds.cache.get(guild.id);
                if (currentGuild) {
                    console.log(`[GuildDelete] Bot rejoined ${guild.name} within 5 minutes. Cleanup cancelled.`);
                    leaveTimers.delete(guild.id);
                    return;
                }

                console.log(`[GuildDelete] 5 minutes passed. Deleting data for guild: ${guild.id}`);

                // قائمة النماذج التي سيتم حذف بياناتها (ما عدا BlackList و User/Membership)
                const modelsToDelete = [
                    { model: Server, query: { serverId: guild.id } },
                    { model: GuildSettings, query: { guildId: guild.id } },
                    { model: Langs, query: { guildIds: guild.id } },
                    { model: Activity, query: { serverId: guild.id } },
                    { model: AutoResponder, query: { guildId: guild.id } },
                    { model: Mentions, query: { guildId: guild.id } },
                    { model: Log, query: { serverId: guild.id } },
                    { model: StatusBar, query: { serverId: guild.id } },
                    { model: UpdateStatus, query: { guildId: guild.id } },
                    { model: WelcomeChannel, query: { guildId: guild.id } },
                    { model: apiKey, query: { guildId: guild.id } },
                    { model: bumpedServer, query: { guildId: guild.id } },
                    { model: BotConfig, query: { guildId: guild.id } }
                ];

                for (const item of modelsToDelete) {
                    try {
                        await item.model.deleteMany(item.query);
                    } catch (err) {
                        console.error(`[GuildDelete] Error deleting from ${item.model.modelName}:`, err.message);
                    }
                }

                // تنظيف الذاكرة المؤقتة للبوت إن وجدت
                if (client.userSettings) client.userSettings.delete(guild.id);
                if (client.languages) client.languages.delete(guild.id);

                console.log(`[GuildDelete] Successfully cleaned up data for guild: ${guild.id}`);
                leaveTimers.delete(guild.id);

            } catch (error) {
                console.error(`[GuildDelete] Critical error during cleanup for ${guild.id}:`, error);
            }
        }, 5 * 60 * 1000);

        // تخزين المؤقت لإلغائه إذا عاد البوت
        leaveTimers.set(guild.id, timer);
    },
    // تصدير leaveTimers لاستخدامه في guildCreate
    leaveTimers
};
