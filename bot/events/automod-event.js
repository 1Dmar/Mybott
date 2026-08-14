const AutoModeration = require('../systems/AutoMod');
const { shouldRunMod } = require('./dashboardModulesGate');
let autoMod;

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (!autoMod && message.client) {
            autoMod = new AutoModeration(message.client);
        }
        if (!autoMod) return;

        if (message.author.bot || !message.guild) return;

        // Real dashboard linkage: moderation runs ONLY if the owner enabled
        // the "Moderation" module from the dashboard (saved in BotConfig.modules)
        try {
            if (!(await shouldRunMod(message.client, message.guild.id))) return;
        } catch (e) {
            console.error('[AutoMod Gate] check failed:', e.message);
            return;
        }
        
        try {
            const result = await autoMod.checkMessage(message);
            
            if (result.violations && result.violations.length > 0) {
                await autoMod.punish(message, result.violations, result.settings);
            }
        } catch (error) {
            console.error('AutoMod Error:', error);
        }
    }
};
