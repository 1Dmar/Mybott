/**
 * guildMemberAdd — الترحيب الحقيقي من إعدادات الداشبورد.
 *
 * الداشبورد يكتب في BotConfig: modules.welcomeMessages و welcome{channelId, message, enabled}
 * والبوت هنا يقرأها من MongoDB ويطبقها فوراً على كل عضو جديد.
 */
const { EmbedBuilder } = require('discord.js');
const DashboardBridge = require('../systems/DashboardBridge');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        if (!member || !member.guild || member.user.bot) return;

        try {
            const bridge = new DashboardBridge(client);
            const config = await bridge.getBotConfig(member.guild.id);

            // Dashboard toggle: "Welcome Messages" module
            if (!config?.modules?.welcomeMessages) return;

            const welcome = config.welcome || {};
            if (!welcome.enabled) return;

            const channelId = welcome.channelId;
            if (!channelId) return;

            const channel = await member.guild.channels.fetch(channelId).catch(() => null);
            if (!channel) {
                console.warn(`[Welcome] Channel ${channelId} not found in ${member.guild.name}`);
                return;
            }

            const message = welcome.message || 'Welcome {user} to {server}! 🎉';
            const embedColor = welcome.embedColor || '#4070f4';

            // Replace placeholders
            const text = message
                .replace(/\{user\}/g, member.toString())
                .replace(/\{username\}/g, member.user.username)
                .replace(/\{server\}/g, member.guild.name)
                .replace(/\{membercount\}/g, String(member.guild.memberCount));

            if (!text.includes(' ')) {
                await channel.send({ content: text }).catch(() => {});
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('🎉 Welcome to the server!')
                .setDescription(text)
                .setColor(embedColor)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            await channel.send({ content: member.toString(), embeds: [embed] }).catch(() => {
                channel.send({ content: text }).catch(() => {});
            });

            console.log(`[Welcome] Sent welcome to ${member.user.tag} in ${member.guild.name}`);
        } catch (err) {
            console.error('[Welcome] Error:', err.message);
        }
    }
};
