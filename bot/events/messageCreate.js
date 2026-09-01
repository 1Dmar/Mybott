const { Collection, AttachmentBuilder, EmbedBuilder, ActionRowBuilder, AuditLogEvent, WebhookClient, ChannelType, ButtonBuilder, ButtonStyle, PermissionsBitField, PermissionFlagsBits } = require("discord.js");
const puppeteer = require('puppeteer');
const dns = require('dns').promises;
const AutoModeration = require('../systems/AutoMod');
let autoMod = null;
const { URL } = require('url');

const decodeList = (hexArr) => hexArr.map(hex => Buffer.from(hex, 'hex').toString());

const { PREFIX } = require("../settings/config");

const User = require("../Models/User");
const axios = require("axios");
const crypto = require('crypto');
const Jimp = require("jimp");
const path = require('path');
const fs = require('fs');
const ServerInfo = require("../Models/Server");
const { getForGuild } = require('../utils/entitlementService');
const { legacyPrefixEnabled } = require('../utils/legacyCommandPolicy');
const { generateServerStatusImage, WALLPAPERS } = require("./interactionCreate");
const WelcomeChannel = require("../Models/WelcomeChannel");
const ApiKey = require('../Models/apiKey');
const BumpedServer = require('../Models/bumpedServer');
const BlackList = require("../Models/BlackList");
const { getActiveBlacklist } = require('../utils/blacklistGuard');
const AutoResponder = require("../Models/AutoResponder");
const BotConfig = require("../Models/BotConfig");
const { DateTime } = require('luxon');
const Log = require('../Models/Log');
const EMOJIS_CONFIG = require("../settings/emojis");

const formatEmoji = (emoji) => {
    if (!emoji) return "";
    if (typeof emoji === 'string') return emoji;
    if (emoji.id) {
        return `<${emoji.animated ? "a" : ""}:emoji:${emoji.id}>`;
    }
    return "";
};

const getEmoji = (name) => {
    const emoji = EMOJIS_CONFIG[name];
    return formatEmoji(emoji);
};

const EMOJIS = {
    BEDROCK: getEmoji('BEDROCK'),
    OFFLINE: getEmoji('OFFLINE'),
    ONLINE: getEmoji('ONLINE'),
    PLAYER: getEmoji('PLAYER'),
    INFORMATION: getEmoji('INFORMATION'),
    ACHIEVEMENT: getEmoji('ACHIEVEMENT'),
    CHECK: getEmoji('CHECK'),
    JAVA: getEmoji('JAVA'),
    WARNING: getEmoji('WARNING'),
    BLOCK: getEmoji('BLOCK'),
    SUCCESS: getEmoji('SUCCESS'),
    ERROR: getEmoji('ERROR'),
    SHIELD: getEmoji('SHIELD'),
    GEAR: getEmoji('GEAR'),
    SEARCH: getEmoji('SEARCH'),
    CLIPBOARD: getEmoji('CLIPBOARD'),
    EDIT: getEmoji('EDIT'),
    LINK: getEmoji('LINK'),
    SPARKLES: getEmoji('SPARKLES'),
    STAR: getEmoji('STAR'),
    PIN: getEmoji('PIN'),
    FIRE: getEmoji('FIRE'),
    ROCKET: getEmoji('ROCKET'),
    UP: getEmoji('UP'),
    DOWN: getEmoji('DOWN')
};

const url = "https://promcbot.dev";
const botConfigCache = new Map();

async function getBotConfig(guildId) {
    const cached = botConfigCache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const value = await BotConfig.findOne({ guildId }).lean().catch(() => null);
    botConfigCache.set(guildId, { value, expiresAt: Date.now() + 15000 });
    return value;
}

const handleAutoResponder = async (message) => {
    if (!message?.guild || message.author?.bot || !message.content?.trim() || message.content.startsWith(PREFIX)) return;
    try {
        const config = await getBotConfig(message.guild.id);
        if (config?.modules?.autoResponder !== true) return;
        const rules = await AutoResponder.find({ guildId: message.guild.id }).limit(25).lean();
        const content = message.content.trim().toLowerCase();
        const rule = rules.find(item => String(item.trigger || '').trim() && content.startsWith(String(item.trigger).trim().toLowerCase()));
        if (!rule?.response) return;
        const response = String(rule.response).replace(/\{user\}/gi, `<@${message.author.id}>`).replace(/\{server\}/gi, message.guild.name).slice(0, 1900);
        await message.reply({ content: response, allowedMentions: { users: [message.author.id] } });
    } catch (error) {
        console.error('Auto responder error:', error.message);
    }
};

const handleMainMessage = async (client, message) => {
    if (!legacyPrefixEnabled() || message.author.bot || !message.guild) return;

    let prefix = PREFIX;
    if (!message.content.startsWith(prefix)) return;

    let args = message.content.slice(prefix.length).trim().split(/ +/);
    let cmd = args.shift()?.toLowerCase();

    if (cmd === 'testing') {
  // يقوم بجمع عدد الأعضاء من كل السيرفرات التي يخدمها البوت حالياً
  const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
  
  message.reply(`إجمالي عدد مستخدمي البوت في كل السيرفرات هو: ${totalUsers}`);
}

    // Command: wallp
    if (cmd === 'wallp') {
        // Permission Check: Manage Guild or Administrator
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply(`${EMOJIS.ERROR} You don't have permission to use this command. (Manage Server required)`);
        }

        const serverId = message.guild.id;
        const serverInfo = await ServerInfo.findOne({ serverId });

        if (!serverInfo) {
            return message.reply(`${EMOJIS.WARNING} No server information found for this guild. Please use \`/setup\` first.`);
        }

        const loadingMsg = await message.reply(`${EMOJIS.SPARKLES} Generating server status image, please wait...`);

        try {
            // Use the saved wallpaper from database, or default to the first one
            const wallpaper = serverInfo.wallpaper || WALLPAPERS[0];
            const imageBuffer = await generateServerStatusImage(serverInfo, wallpaper, { guild: message.guild }, false);
            
            const attachment = new AttachmentBuilder(imageBuffer, { 
                name: `${serverInfo.serverName.replace(/[^a-zA-Z0-9]/g, '_')}_status.png` 
            });

            await loadingMsg.edit({
                content: `${EMOJIS.CHECK} **Server Status Image:**`,
                files: [attachment]
            });
        } catch (error) {
            console.error('Error in wallp command:', error);
            await loadingMsg.edit(`${EMOJIS.ERROR} An error occurred while generating the image.`);
        }
        return;
    }
    if (!client.mcommands) return;
    const command = client.mcommands.get(cmd);
    if (!command) return;

    if (!client.userSettings) client.userSettings = new Collection();
    let serverdb = client.userSettings.get(message.guild.id);
    let serverdbbl = client.userSettings.get(message.guild.id + "_bl");

    try {
        // Fetch user settings from the database if not cached
        if (!serverdb) {
            const findUser = await User.findOne({ Id: message.guild.id });
            if (!findUser) {
                const newUser = await User.create({ Id: message.guild.id });
                client.userSettings.set(message.guild.id, newUser);
                serverdb = newUser;
            } else {
                serverdb = findUser;
                client.userSettings.set(message.guild.id, findUser);
            }
        }

        // Fetch blacklist entry from the database if not cached
        if (!serverdbbl) {
            const findBlackList = await BlackList.findOne({ guildIds: message.guild.id });
            if (findBlackList) {
                client.userSettings.set(message.guild.id + "_bl", findBlackList);
                serverdbbl = findBlackList;
            }
        }

        // Blacklist check. Re-read the entry so expiry is enforced even when the cache is stale.
        const activeBlacklist = await getActiveBlacklist(message.guild.id);
        if (activeBlacklist) {
            client.userSettings.set(message.guild.id + "_bl", activeBlacklist);
            const replyMessage = await message.reply({
                content: `> \`${message.guild.name}\`${EMOJIS.BLOCK} Server has been Blacklisted from ProMcBot`,
            });
            
            setTimeout(() => {
                replyMessage.delete().catch(console.error);
            }, 5000);
            return;
        }
        if (serverdbbl) client.userSettings.delete(message.guild.id + "_bl");

        // Permissions check
        if (
            command.userPermissions &&
            !message.member.permissions.has(command.userPermissions)
        ) {
            return message.reply({
                content: `${EMOJIS.WARNING} you don't have enough permissions !!`,
            });
        } else if (
            command.botPermissions &&
            !message.guild.members.me.permissions.has(command.botPermissions)
        ) {
            return message.reply({
                content: `${EMOJIS.WARNING} I don't have enough permissions !!`,
            });
        } else if (cooldown(message, command)) {
            return message.reply({
                content: `${EMOJIS.WARNING} You are On Cooldown , wait \`${cooldown(
                    message,
                    command,
                ).toFixed()}\` Seconds`,
            });
        } else if (command.membership && !(await getForGuild(message.guild.id).then(entitlement => entitlement.plan !== 'free').catch(() => false))) {
            const replyMessage = await message.reply({
                content: `> \`${message.guild.name}\`${EMOJIS.WARNING} Server is Not a Premium Server`,
            });
            
            setTimeout(() => {
                replyMessage.delete().catch(console.error);
            }, 5000);
            return;
        } else {
            command.run(client, message, args, prefix);
        }
    } catch (error) {
        console.error("Error handling command:", error);
        message.reply(`${EMOJIS.WARNING} An error occurred while processing the command, You can contact technical support`);
    }
};

function cooldown(message, cmd) {
    if (!message || !cmd) return;
    let { client, member } = message;
    if (!client.cooldowns.has(cmd.name)) {
        client.cooldowns.set(cmd.name, new Collection());
    }
    const now = Date.now();
    const timestamps = client.cooldowns.get(cmd.name);
    const cooldownAmount = cmd.cooldown * 1000;
    if (timestamps.has(member.id)) {
        const expirationTime = timestamps.get(member.id) + cooldownAmount;
        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return timeLeft;
        } else {
            timestamps.set(member.id, now);
            setTimeout(() => timestamps.delete(member.id), cooldownAmount);
            return false;
        }
    } else {
        timestamps.set(member.id, now);
        setTimeout(() => timestamps.delete(member.id), cooldownAmount);
        return false;
    }
}

const handleAutoMod = async (client, message) => {
    if (!message || message.author?.bot || !message.guild) return;
    try {
        if (!autoMod) autoMod = new AutoModeration(client);
        const result = await autoMod.checkMessage(message);
        if (result?.violations?.length) await autoMod.punish(message, result.violations, result.settings);
    } catch (error) {
        console.error('AutoMod error:', error.message);
    }
};

const handleMcMessage = async (client, message) => {
    if (/^mc\b/i.test(message.content)) {
        const serverId = message.guild.id;
        let icon;

        // Fetch server information from MongoDB
        const serverInfo = await ServerInfo.findOne({ serverId });
        if (!serverInfo) {
            return;
        }
        let emoji;
        // Check membership for custom servers
        const membershipInfo = await User.findOne({ Id: serverId });
        if (serverInfo.serverType === "custom" && !membershipInfo?.ismembership) {
            if (message) {
                const membershipMessage = await message.channel.send(`${EMOJIS.WARNING} Premium not active for this server. Please contact the server owner.`);
                setTimeout(() => {
                    membershipMessage.delete();
                }, 10000);
            }
            return { error: "Premium not active for this server." };
        }

        try {
            const javaIP = serverInfo.javaIP;
            const javaPort = serverInfo.javaPort || 25565;
            let javaServerData = {};
            if (serverInfo.serverType === "java" || serverInfo.serverType === "custom") {
                emoji = EMOJIS.JAVA;
                try {
                    const javaResponse = await axios.get(`https://api.mcsrvstat.us/3/${javaIP}:${javaPort}`);
                    javaServerData = javaResponse.data;
                } catch (error) {
                    console.error("Error fetching Java server information:", error);
                    javaServerData = { online: false };
                }
            }

            const bedrockIP = serverInfo.bedrockIP;
            const bedrockPort = serverInfo.bedrockPort || 19132;
            let bedrockServerData = {};
            if (serverInfo.serverType === "bedrock" || serverInfo.serverType === "custom") {
                emoji = EMOJIS.BEDROCK;
                try {
                    const bedrockResponse = await axios.get(`https://api.mcsrvstat.us/bedrock/3/${bedrockIP}:${bedrockPort}`);
                    bedrockServerData = bedrockResponse.data;
                } catch (error) {
                    console.error("Error fetching Bedrock server information:", error);
                    bedrockServerData = { online: false };
                }
            }

            icon = javaServerData.online ? `https://eu.mc-api.net/v3/server/favicon/${javaIP}:${javaPort}` : bedrockServerData.online ? `https://eu.mc-api.net/v3/server/favicon/${bedrockIP}:${bedrockPort}` : 'https://api.mcstatus.io/v2/icon/dfgfdg.xyz';

            // Construct embed based on server type and availability
            const embed = new EmbedBuilder()
                .setColor(javaServerData.online || bedrockServerData.online ? "#90EE90" : "#FF7F7F")
                .setThumbnail(icon)
                .setTitle(`${javaServerData.online || bedrockServerData.online ? EMOJIS.ONLINE + " Online" : EMOJIS.OFFLINE + " Offline"} ${serverInfo.serverName || "Minecraft"} Server`);

const addFieldsToEmbed = (serverType, serverData, ip, port) => {
                embed.addFields(
                    { name: `${EMOJIS.UP} ${emoji} ${serverType} IP`, value: `**${ip}:${port}**`, inline: false },
                    {
                        name: `${EMOJIS.UP} ${emoji} ${serverType} Informations`,
                        value: `**${EMOJIS.DOWN} ${serverData.online ? EMOJIS.ONLINE + " Online" : EMOJIS.OFFLINE + " Offline"}\n${EMOJIS.DOWN} ${EMOJIS.PLAYER} ${serverData.players?.online ?? "0"} / ${serverData.players?.max ?? "0"} Players\n${EMOJIS.DOWN} ${EMOJIS.INFORMATION} ${serverData.version || "N/A"}**`,
                        inline: false,
                    }
                );
            };

            if (serverInfo.serverType === "java") {
                addFieldsToEmbed("Java", javaServerData, serverInfo.javaIP, serverInfo.javaPort);
            } else if (serverInfo.serverType === "bedrock") {
                addFieldsToEmbed("Bedrock", bedrockServerData, serverInfo.bedrockIP, serverInfo.bedrockPort);
            } else if (serverInfo.serverType === "custom") {
                addFieldsToEmbed("Java", javaServerData, serverInfo.javaIP, serverInfo.javaPort);
                addFieldsToEmbed("Bedrock", bedrockServerData, serverInfo.bedrockIP, serverInfo.bedrockPort);

                const javaPlayers = parseInt(javaServerData.players?.online) || 0;
                const bedrockPlayers = parseInt(bedrockServerData.players?.online) || 0;
                const playersDifference = Math.abs(javaPlayers - bedrockPlayers);

                if (javaServerData.online && bedrockServerData.online && playersDifference <= 10) {
                    embed.addFields({
                        name: `${EMOJIS.UP} Global Informations`,
                        value: `**${EMOJIS.DOWN} ${javaServerData.online ? EMOJIS.ONLINE + ' Online' : EMOJIS.OFFLINE + ' Offline'}\n${EMOJIS.DOWN} ${EMOJIS.PLAYER} ${javaPlayers + bedrockPlayers} / ${(parseInt(javaServerData.players?.max) || 0) + (parseInt(bedrockServerData.players?.max) || 0)} Players\n${EMOJIS.DOWN} ${EMOJIS.INFORMATION} ${javaServerData.version || bedrockServerData.version || "N/A"}**`,
                        inline: false,
                    });
                } else {
                    if (javaServerData.online) {
                        embed.addFields({
                            name: `${EMOJIS.UP} ${EMOJIS.JAVA} Java Informations`,
                            value: `**${EMOJIS.DOWN} ${EMOJIS.ONLINE} Java Server online\n${EMOJIS.DOWN} ${EMOJIS.PLAYER} ${javaPlayers} / ${javaServerData.players?.max || "0"} Players\n${EMOJIS.DOWN} ${EMOJIS.INFORMATION} ${javaServerData.version || "N/A"}**`,
                            inline: false,
                        });
                    } 
                    if (bedrockServerData.online) {
                        embed.addFields({
                            name: `${EMOJIS.UP} ${EMOJIS.BEDROCK} Bedrock Informations`,
                            value: `**${EMOJIS.DOWN} ${EMOJIS.ONLINE} Bedrock Server online\n${EMOJIS.DOWN} ${EMOJIS.PLAYER} ${bedrockPlayers} / ${bedrockServerData.players?.max || "0"} Players\n${EMOJIS.DOWN} ${EMOJIS.INFORMATION} ${bedrockServerData.version || "N/A"}**`,
                            inline: false,
                        });
                    }
                }
            }

            embed.setTimestamp().setFooter({ text: `© ${new Date().getFullYear()} - 2024 ProMcBot - All Rights Reserved.` });

            if (message) {
                message.reply({ embeds: [embed] });
            }
            return { embed };
        } catch (error) {
            console.error("Error fetching server information:", error);

            const errorEmbed = new EmbedBuilder()
                .setColor("#FF7F7F")
                .setThumbnail(icon)
                .setTitle(`${EMOJIS.OFFLINE} ${serverInfo.serverName || "Minecraft"} Server`);

            if (serverInfo.serverType === "java") {
                errorEmbed.addFields(
                    { name: `${EMOJIS.UP} ${EMOJIS.JAVA} Java IP`, value: `**${serverInfo.javaIP}:${serverInfo.javaPort}**`, inline: false },
                    {
                        name: `${EMOJIS.UP} Informations`,
                        value: `**${EMOJIS.DOWN} ${EMOJIS.OFFLINE} Offline\n${EMOJIS.DOWN} ${EMOJIS.PLAYER} 0 / 0 Players\n${EMOJIS.DOWN} ${EMOJIS.INFORMATION} N/A**`,
                        inline: false,
                    }
                );
            } else if (serverInfo.serverType === "bedrock") {
                errorEmbed.addFields(
                    { name: `${EMOJIS.UP} ${EMOJIS.BEDROCK} Bedrock IP`, value: `**${serverInfo.bedrockIP}:${serverInfo.bedrockPort}**`, inline: false },
                    {
                        name: `${EMOJIS.UP} Global Informations`,
                        value: `**${EMOJIS.DOWN} ${EMOJIS.OFFLINE} Offline\n${EMOJIS.DOWN} ${EMOJIS.PLAYER} 0 / 0 Players\n${EMOJIS.DOWN} ${EMOJIS.INFORMATION} N/A**`,
                        inline: false,
                    }
                );
            } else if (serverInfo.serverType === "custom") {
                errorEmbed.addFields(
                    { name: `${EMOJIS.UP} ${EMOJIS.JAVA} Java IP`, value: `**${serverInfo.javaIP}:${serverInfo.javaPort}**`, inline: false },
                    { name: `${EMOJIS.UP} ${EMOJIS.BEDROCK} Bedrock IP`, value: `**${serverInfo.bedrockIP}:${serverInfo.bedrockPort}**`, inline: false },
                    {
                        name: `${EMOJIS.UP} Global Informations`,
                        value: `**${EMOJIS.DOWN} ${EMOJIS.OFFLINE} Offline\n${EMOJIS.DOWN} ${EMOJIS.PLAYER} 0 / 0 Players\n${EMOJIS.DOWN} ${EMOJIS.INFORMATION} N/A**`,
                        inline: false,
                    }
                );
            }

            errorEmbed.setTimestamp().setFooter({ text: `© ${new Date().getFullYear()} - 2024 ProMcBot - All Rights Reserved.` });

            if (message) {
                message.reply({ embeds: [errorEmbed] });
            }

            return { error: "Error fetching server information" };
        }
    }
};

module.exports = {
    name: "messageCreate",
    async execute(message, client) {
        await handleAutoResponder(message);
        await handleMainMessage(client, message);
        await handleMcMessage(client, message);
        await handleAutoMod(client, message);
    }
};
