const { leaveTimers } = require('./guildDelete');

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
    }
};
