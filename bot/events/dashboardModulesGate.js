/**
 * dashboardModulesGate — بوابة الوحدات من الداشبورد على مستوى الرسائل.
 *
 * يقرأ modules من BotConfig (التي يحفظها المالك من الداشبورد) ويقرر
 * ما إذا كانت أنظمة البوت نشطة في هذا السيرفر:
 *   - modules.moderation      → AutoMod
 *   - modules.autoResponder   → الردود التلقائية
 *
 * هذا هو الربط الحقيقي: بدون تفعيل الوحدة من الداشبورد، الأنظمة لا تعمل.
 */
'use strict';
const DashboardBridge = require('../systems/DashboardBridge');

const cache = new Map(); // guildId -> {moderation, autoResponder, at}
const TTL = 30_000;

async function getModules(client, guildId) {
    const now = Date.now();
    const c = cache.get(guildId);
    if (c && now - c.at < TTL) return c.value;

    try {
        const bridge = new DashboardBridge(client);
        const config = await bridge.getBotConfig(guildId);
        const modules = config?.modules || {};
        cache.set(guildId, { value: modules, at: now });
        return modules;
    } catch {
        return {};
    }
}

module.exports = {
    async shouldRunMod(client, guildId) {
        const modules = await getModules(client, guildId);
        return Boolean(modules.moderation);
    },
    async shouldRunAutoResponder(client, guildId) {
        const modules = await getModules(client, guildId);
        return Boolean(modules.autoResponder);
    },
    invalidate(guildId) {
        cache.delete(guildId);
    }
};
