const { leaveTimers } = require('./guildDelete');
const BotConfig = require('../Models/BotConfig');
const GuildSettings = require('../Models/GuildSettings');

module.exports = {
    name: 'guildCreate',
    async execute(guild, client) {
        console.log(`[GuildCreate] Bot joined guild: ${guild.name} (${guild.id})`);

        // التحقق مما إذا كان هناك مؤقت حذف جاري لهذا السيرفر
        if (leaveTimers && leaveTimers.has(guild.id)) {
            console.log(`[GuildCreate] Cancelling scheduled data deletion for ${guild.name} as bot rejoined within 5 minutes.`);
            clearTimeout(leaveTimers.get(guild.id));
            leaveTimers.delete(guild.id);
        }

        // Dashboard linkage: create default configs so dashboard pages work immediately
        try {
            await BotConfig.findOneAndUpdate(
                { guildId: guild.id },
                { $set: { guildId: guild.id } },
                { upsert: true }
            );
            await GuildSettings.findOneAndUpdate(
                { guildId: guild.id },
                { $set: { guildId: guild.id } },
                { upsert: true }
            );
            console.log(`[GuildCreate] Created default dashboard config for ${guild.name}`);
        } catch (err) {
            console.error(`[GuildCreate] Default config error:`, err.message);
        }
    }
};
