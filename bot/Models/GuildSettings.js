const mongoose = require('mongoose');

const GuildSettingsSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    automod: {
        enabled: {
            type: Boolean,
            default: false
        },
        filters: {
            badwords: {
                type: Boolean,
                default: true
            },
            caps: {
                type: Boolean,
                default: true
            },
            spam: {
                type: Boolean,
                default: true
            },
            invites: {
                type: Boolean,
                default: true
            },
            links: {
                type: Boolean,
                default: false
            },
            mentions: {
                type: Boolean,
                default: true
            }
        },
        limits: {
            capsPercentage: {
                type: Number,
                default: 70
            },
            spamCount: {
                type: Number,
                default: 5
            },
            spamInterval: {
                type: Number,
                default: 5000
            },
            maxMentions: {
                type: Number,
                default: 5
            }
        },
        action: {
            type: String,
            default: 'delete' // delete, warn, timeout, kick, ban
        },
        logChannel: {
            type: String,
            default: null
        }
    },
    whitelist: {
        roles: [String],
        channels: [String],
        users: [String]
    }
}, { timestamps: true });

// Static method to get or create settings
GuildSettingsSchema.statics.getSettings = async function(guildId) {
    let settings = await this.findOne({ guildId });
    if (!settings) {
        settings = new this({ guildId });
        await settings.save();
    }
    return settings;
};

module.exports = mongoose.model('GuildSettings', GuildSettingsSchema);
