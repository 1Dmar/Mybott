const { Collection, AttachmentBuilder, EmbedBuilder, ActionRowBuilder, AuditLogEvent, WebhookClient, ChannelType, ButtonBuilder, ButtonStyle, PermissionsBitField } = require("discord.js");
const puppeteer = require('puppeteer');
const dns = require('dns').promises;
const { URL } = require('url');

const decodeList = (hexArr) => hexArr.map(hex => Buffer.from(hex, 'hex').toString());

const { PREFIX, apikey } = require("../settings/config");
const User = require("../Models/User");
const axios = require("axios");
const db = require("pro.db");
const crypto = require('crypto');
const Jimp = require("jimp");
const path = require('path');
const fs = require('fs');
const ServerInfo = require("../Models/Server");
const Servermembership = require("../Models/User");
const WelcomeChannel = require("../Models/WelcomeChannel");
const ApiKey = require('../Models/apiKey');
const BumpedServer = require('../Models/bumpedServer');
const BlackList = require("../Models/BlackList");
const AutoResponder = require("../Models/AutoResponder");
const { DateTime } = require('luxon');
const Log = require('../Models/Log');

const url = "http://promcbot.qzz.io";

const handleMainMessage = async (client, message) => {
    if (message.author.bot || !message.guild) return;

    let prefix = PREFIX;
    if (!message.content.startsWith(prefix)) return;

    let args = message.content.slice(prefix.length).trim().split(/ +/);
    let cmd = args.shift()?.toLowerCase();
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

        // Blacklist check
        if (serverdbbl && serverdbbl.isBlacklisted === 'true') {
            const replyMessage = await message.reply({
                content: `> \`${message.guild.name}\`<:Block:1410147617056362558> Server has been Blacklisted from ProMcBot`,
            });
            
            setTimeout(() => {
                replyMessage.delete().catch(console.error);
            }, 5000);
            return;
        }

        // Permissions check
        if (
            command.userPermissions &&
            !message.member.permissions.has(command.userPermissions)
        ) {
            return message.reply({
                content: `<:Warning:1410147601281581118> you don't have enough permissions !!`,
            });
        } else if (
            command.botPermissions &&
            !message.guild.members.me.permissions.has(command.botPermissions)
        ) {
            return message.reply({
                content: `<:Warning:1410147601281581118> I don't have enough permissions !!`,
            });
        } else if (cooldown(message, command)) {
            return message.reply({
                content: `<:Warning:1410147601281581118> You are On Cooldown , wait \`${cooldown(
                    message,
                    command,
                ).toFixed()}\` Seconds`,
            });
        } else if (command.membership && serverdb && !serverdb.ismembership) {
            const replyMessage = await message.reply({
                content: `> \`${message.guild.name}\`<:Warning:1410147601281581118> Server is Not a MemberShip Server`,
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
        message.reply("<:Warning:1410147601281581118> An error occurred while processing the command, You can contact technical support");
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
        const membershipInfo = await Servermembership.findOne({ Id: serverId });
        if (serverInfo.serverType === "custom" && !membershipInfo?.ismembership) {
            if (message) {
                const membershipMessage = await message.channel.send('<:Warning:1410147601281581118> Membership not active for this server. Please contact the server owner.');
                setTimeout(() => {
                    membershipMessage.delete();
                }, 10000);
            }
            return { error: "Membership not active for this server." };
        }

        try {
            const javaIP = serverInfo.javaIP;
            const javaPort = serverInfo.javaPort || 25565;
            let javaServerData = {};
            if (serverInfo.serverType === "java" || serverInfo.serverType === "custom") {
                emoji = "<:Java:1410147547363934300>";
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
                emoji = "<:Bedrock:1410147921676075038>";
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
                .setTitle(`${javaServerData.online || bedrockServerData.online ? "<:Online:1410178650070061096> Online" : "<:Offline:1410178629098278922> Offline"} ${serverInfo.serverName || "Minecraft"} Server`);

            const addFieldsToEmbed = (serverType, serverData, ip, port) => {
                embed.addFields(
                    { name: `<:promc_up:1243498882952855604> ${emoji} ${serverType} IP`, value: `**${ip}:${port}**`, inline: false },
                    {
                        name: `<:promc_up:1243498882952855604> ${emoji} ${serverType} Informations`,
                        value: `**<:promc_down:1243498861041942538> ${serverData.online ? "<:Online:1410178650070061096> Online" : "<:Offline:1410178629098278922> Offline"}\n<:promc_down:1243498861041942538> <:Player:1410147631308603494> ${serverData.players?.online || "٠٠"} / ${serverData.players?.max || "٠٠"} Players\n<:promc_down:1243498861041942538> <:Information:1410147645883678763> ${serverData.version || "٠٠"}**`,
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

                const javaPlayers = javaServerData.players?.online || "٠٠";
                const bedrockPlayers = bedrockServerData.players?.online || "٠٠";
                const playersDifference = Math.abs(javaPlayers - bedrockPlayers);

                if (javaServerData.online && bedrockServerData.online && playersDifference <= 10) {
                    embed.addFields({
                        name: "<:promc_up:1243498882952855604> Global Informations",
                        value: `**<:promc_down:1243498861041942538> ${javaServerData.online ? '<:Online:1410178650070061096> Online' : '<:Offline:1410178629098278922> Offline'}\n<:promc_down:1243498861041942538> <:Player:1410147631308603494> ${javaPlayers || bedrockPlayers} / ${javaServerData.players?.max || bedrockServerData.players?.max || "٠٠"} Players\n<:promc_down:1243498861041942538> <:Information:1410147645883678763> ${javaServerData.version || bedrockServerData.version || "٠٠"}**`,
                        inline: false,
                    });
                } else {
                    if (javaServerData.online) {
                        embed.addFields({
                            name: "<:promc_up:1243498882952855604> <:Java:1410147547363934300> Java Informations",
                            value: `**<:promc_down:1243498861041942538> <:Online:1410178650070061096>Java Server online\n<:promc_down:1243498861041942538> <:Player:1410147631308603494> ${javaPlayers} / ${javaServerData.players?.max || "٠٠"} Players\n<:promc_down:1243498861041942538> <:Information:1410147645883678763> ${javaServerData.version || "٠٠"}**`,
                            inline: false,
                        });
                    } 
                    if (bedrockServerData.online) {
                        embed.addFields({
                            name: "<:promc_up:1243498882952855604> <:Bedrock:1410147921676075038> Bedrock Informations",
                            value: `**<:promc_down:1243498861041942538> <:Online:1410178650070061096> Bedrock Server online\n<:promc_down:1243498861041942538> <:Player:1410147631308603494> ${bedrockPlayers} / ${bedrockServerData.players?.max || "٠٠"} Players\n<:promc_down:1243498861041942538> <:Information:1410147645883678763> ${bedrockServerData.version || "٠٠"}**`,
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
                .setTitle(`<:Offline:1410178629098278922> ${serverInfo.serverName || "Minecraft"} Server`);

            if (serverInfo.serverType === "java") {
                errorEmbed.addFields(
                    { name: "<:promc_up:1243498882952855604> <:Java:1410147547363934300> Java IP", value: `**${serverInfo.javaIP}:${serverInfo.javaPort}**`, inline: false },
                    {
                        name: "<:promc_up:1243498882952855604> Informations",
                        value: `**<:promc_down:1243498861041942538> <:Offline:1410178629098278922> Offline\n<:promc_down:1243498861041942538> <:Player:1410147631308603494> ٠٠ / ٠٠ Players\n<:promc_down:1243498861041942538> <:Information:1410147645883678763> ٠٠**`,
                        inline: false,
                    }
                );
            } else if (serverInfo.serverType === "bedrock") {
                errorEmbed.addFields(
                    { name: "<:promc_up:1243498882952855604> <:Bedrock:1410147921676075038> Bedrock IP", value: `**${serverInfo.bedrockIP}:${serverInfo.bedrockPort}**`, inline: false },
                    {
                        name: "<:promc_up:1243498882952855604> Global Informations",
                        value: `**<:promc_down:1243498861041942538> <:Offline:1410178629098278922> Offline\n<:promc_down:1243498861041942538> <:Player:1410147631308603494> ٠٠ / ٠٠ Players\n<:promc_down:1243498861041942538> <:Information:1410147645883678763> ٠٠**`,
                        inline: false,
                    }
                );
            } else if (serverInfo.serverType === "custom") {
                errorEmbed.addFields(
                    { name: "<:promc_up:1243498882952855604> <:Java:1410147547363934300> Java IP", value: `**${serverInfo.javaIP}:${serverInfo.javaPort}**`, inline: false },
                    { name: "<:promc_up:1243498882952855604> <:Bedrock:1410147921676075038> Bedrock IP", value: `**${serverInfo.bedrockIP}:${serverInfo.bedrockPort}**`, inline: false },
                    {
                        name: "<:promc_up:1243498882952855604> Informations",
                        value: `**<:promc_down:1243498861041942538> <:Offline:1410178629098278922> Custom Server offline\n<:promc_down:1243498861041942538> <:Player:1410147631308603494> ٠٠ / ٠٠ Players\n<:promc_down:1243498861041942538> <:Information:1410147645883678763> ٠٠**`,
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
        await handleMainMessage(client, message);
        await handleMcMessage(client, message);
    }
};
