const { EmbedBuilder } = require('discord.js');
const GuildSettings = require('../Models/GuildSettings');
const { containsBadWords } = require('../utils/badwords');

// Spam cache: userId -> [timestamps]
const spamCache = new Map();

class AutoModeration {
    constructor(client) {
        this.client = client;
        // Clean cache every 5 minutes
        setInterval(() => this.cleanCache(), 300000);
    }

    // Check if member is whitelisted
    isWhitelisted(member, channelId, settings) {
        if (!member || !settings) return false;
        
        // Admins are always whitelisted
        if (member.permissions.has('Administrator')) return true;

        const { whitelist } = settings;
        
        // Check roles
        if (whitelist.roles.some(roleId => member.roles.cache.has(roleId))) return true;
        
        // Check channels
        if (whitelist.channels.includes(channelId)) return true;
        
        // Check users
        if (whitelist.users.includes(member.id)) return true;

        return false;
    }

    async checkMessage(message) {
        if (!message.guild || message.author.bot) return { violations: [] };

        const settings = await GuildSettings.getSettings(message.guild.id);
        if (!settings.automod.enabled) return { violations: [] };

        // Check whitelist
        if (this.isWhitelisted(message.member, message.channel.id, settings)) return { violations: [] };

        const violations = [];
        const content = message.content;
        const { filters, limits } = settings.automod;

        // 1. Bad Words Filter
        if (filters.badwords && containsBadWords(content)) {
            violations.push({ type: 'badwords', reason: 'Profanity/Inappropriate Language' });
        }

        // 2. Caps Filter
        if (filters.caps && content.length >= 10) {
            const capsCount = content.replace(/[^A-Z]/g, "").length;
            const capsPercentage = (capsCount / content.length) * 100;
            if (capsPercentage >= limits.capsPercentage) {
                violations.push({ type: 'caps', reason: 'Excessive Caps' });
            }
        }

        // 3. Invite Links Filter
        if (filters.invites) {
            const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)/i;
            if (inviteRegex.test(content)) {
                violations.push({ type: 'invites', reason: 'Discord Invite Link' });
            }
        }

        // 4. External Links Filter
        if (filters.links) {
            const linkRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i;
            if (linkRegex.test(content) && !content.includes('discord.gg')) { // Invites handled separately
                violations.push({ type: 'links', reason: 'External Link' });
            }
        }

        // 5. Mention Spam Filter
        if (filters.mentions) {
            const mentionCount = message.mentions.users.size + message.mentions.roles.size;
            if (mentionCount > limits.maxMentions) {
                violations.push({ type: 'mentions', reason: 'Mention Spam' });
            }
        }

        // 6. Message Spam Filter
        if (filters.spam) {
            const isSpamming = this.checkSpam(message.author.id, limits.spamCount, limits.spamInterval);
            if (isSpamming) {
                violations.push({ type: 'spam', reason: 'Message Spamming' });
            }
        }

        return { violations, settings };
    }

    checkSpam(userId, limit, interval) {
        const now = Date.now();
        const userMessages = spamCache.get(userId) || [];
        
        // Filter out old messages
        const recentMessages = userMessages.filter(timestamp => now - timestamp < interval);
        recentMessages.push(now);
        
        spamCache.set(userId, recentMessages);

        return recentMessages.length > limit;
    }

    cleanCache() {
        const now = Date.now();
        for (const [userId, timestamps] of spamCache.entries()) {
            const recent = timestamps.filter(ts => now - ts < 60000); // Keep last 1 min
            if (recent.length === 0) {
                spamCache.delete(userId);
            } else {
                spamCache.set(userId, recent);
            }
        }
    }

    async punish(message, violations, settings) {
        const action = settings.automod.action;
        const actionsTaken = [];

        try {
            // Always delete the message for any violation
            if (message.deletable) {
                await message.delete().catch(() => {});
                actionsTaken.push('Message Deleted');
            }

            // Perform additional actions
            switch (action) {
                case 'warn':
                    await this.sendWarning(message, violations);
                    actionsTaken.push('User Warned');
                    break;
                case 'timeout':
                    if (message.member.moderatable) {
                        await message.member.timeout(3600000, 'Auto-Moderation: Violation').catch(() => {});
                        actionsTaken.push('Timed out (1h)');
                    }
                    break;
                case 'kick':
                    if (message.member.kickable) {
                        await message.member.kick('Auto-Moderation: Violation').catch(() => {});
                        actionsTaken.push('Kicked');
                    }
                    break;
                case 'ban':
                    if (message.member.bannable) {
                        await message.member.ban({ reason: 'Auto-Moderation: Violation' }).catch(() => {});
                        actionsTaken.push('Banned');
                    }
                    break;
            }

            // Log the violation
            if (settings.automod.logChannel) {
                await this.logViolation(message, violations, actionsTaken, settings.automod.logChannel);
            }

        } catch (error) {
            console.error('Punishment Error:', error);
        }
    }

    async sendWarning(message, violations) {
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('⚠️ Auto-Moderation Warning')
            .setDescription(`Your message in **${message.guild.name}** was removed due to policy violations.`)
            .addFields(
                { name: 'Reason(s)', value: violations.map(v => `• ${v.reason}`).join('\n') }
            )
            .setTimestamp();

        await message.author.send({ embeds: [embed] }).catch(() => {
            // If DMs are closed, send a temporary message in the channel
            message.channel.send(`${message.author}, please follow the server rules. (DMs Closed)` )
                .then(msg => setTimeout(() => msg.delete(), 5000));
        });
    }

    async logViolation(message, violations, actions, logChannelId) {
        const logChannel = message.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setAuthor({ name: 'Auto-Moderation Log', iconURL: message.author.displayAvatarURL() })
            .addFields(
                { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
                { name: 'Channel', value: `${message.channel}`, inline: true },
                { name: 'Violations', value: violations.map(v => `• ${v.reason}`).join('\n'), inline: false },
                { name: 'Actions Taken', value: actions.join(', ') || 'None', inline: true },
                { name: 'Message Content', value: message.content.substring(0, 1000) || 'N/A' }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
}

module.exports = AutoModeration;
