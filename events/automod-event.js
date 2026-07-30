const AutoModeration = require('../systems/AutoMod');
let autoMod;

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (!autoMod && message.client) {
            autoMod = new AutoModeration(message.client);
        }
        if (!autoMod) return;

        if (message.author.bot || !message.guild) return;
        
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
