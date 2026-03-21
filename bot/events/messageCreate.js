const { Collection, AttachmentBuilder, EmbedBuilder, ActionRowBuilder, AuditLogEvent, WebhookClient, ChannelType, ButtonBuilder, ButtonStyle, PermissionsBitField } = require("discord.js");
const client = require("../index");

const puppeteer = require('puppeteer');
const dns = require('dns').promises;
const { URL } = require('url');

const decodeList = (hexArr) => hexArr.map(hex => Buffer.from(hex, 'hex').toString());


const { PREFIX, apikey } = require("../settings/config");
const User = require("../Models/User");
const { Chart, registerables } = require('chart.js');
//const { createCanvas } = require('canvas');
const axios = require("axios");
const db = require("pro.db");
const crypto = require('crypto');
const Jimp = require("jimp");
const path = require('path');
const fs = require('fs');
const ServerInfo = require("../Models/Server");
//const DailyCount = require("../Models/DailyCount");
const Servermembership = require("../Models/User");
const WelcomeChannel = require("../Models/WelcomeChannel");
const ApiKey = require('../Models/apiKey');
const BumpedServer = require('../Models/bumpedServer');
const BlackList = require("../Models/BlackList");
const AutoResponder = require("../Models/AutoResponder");
const { DateTime } = require('luxon');
const Log = require('../Models/Log');
const url = "http://promcbot.qzz.io";
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    let prefix = PREFIX;
    if (!message.content.startsWith(prefix)) return;

    let args = message.content.slice(prefix.length).trim().split(/ +/);
    let cmd = args.shift()?.toLowerCase();
    const command = client.mcommands.get(cmd);
    if (!command) return;

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
});

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

client.on("messageCreate", async (message) => {
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
});


client.on("messageCreate", async (message) => {
    if (message.content.startsWith("getstarted") && message.author.id === "804999528129363998") {
        const args = message.content.split(" ");
        const channelId = args[1] || message.channel.id;

        const channel = message.guild.channels.cache.get(channelId);
        if (!channel) {
            return message.reply("Channel not found.");
        }

        const embed = new EmbedBuilder()
            .setColor("#ee3c37")
            .setTitle("ProMcBot New Version")
            .setDescription("**<:dev:1252930632976175136> The ProMcBot team welcomes you and thanks you for trying the new version of the bot.\n<:promc_down:1243498861041942538> Arrange these steps properly to run the bot on your server without any issues.**")
            .setThumbnail(client.user.displayAvatarURL());

        const embed2 = new EmbedBuilder()
            .setColor("#ee3c37")
            .setTitle("Step #1")
            .setDescription("Invite the bot to your Discord server using [This Link](https://discord.com/oauth2/authorize?client_id=1220005260857311294&permissions=537250992&integration_type=0&scope=bot+applications.commands).");

        const embed3 = new EmbedBuilder()
            .setColor("#ee3c37")
            .setTitle("Step #2")
            .setDescription("You can use </setup_server:1252742843206733928> command or type: \`/setup_server\` in your Discord server to connect the bot to your Minecraft server, and then you can choose either Java, Bedrock, or Custom for MemberShip Premium bot only!.");

        const embed4 = new EmbedBuilder()
            .setColor("#ee3c37")
            .setTitle("Step #3")
            .setDescription("You can make changes to the language of your Discord server and your Minecraft server very soon!.")
            .setFooter({ text: "© 2024 ProMcBot - All Rights Reserved." });

        message.delete();
        channel.send({ embeds: [embed, embed2, embed3, embed4] });
    }
});

client.on("messageCreate", async (message) => {
    if (message.content.startsWith("getrules") && message.author.id === "804999528129363998") {
        const args = message.content.split(" ");
        const channelId = args[1] || message.channel.id;

        const channel = message.guild.channels.cache.get(channelId);
        if (!channel) {
            return message.reply("Channel not found.");
        }

        const rules = [
            "Do not invite the bot to servers that violate Discord's rules and guidelines.",
            "We are not responsible for any misuse of the bot.",
            "It is not allowed for anyone to use vulnerabilities to extend the duration of Premium Membership except through the method permitted by us.",
            "You can inquire about anything related to the bot only through the bot's [Our ProMcBot Support](https://discord.gg/6FjFYStz5a).",
            "### ProMcBot Support Rules",
            "Not to disturb the technical support team for ProMcBot.",
            "Avoid repeating suggestions.",
            "Do not mention (links, Discord server names, names of competing bots, adult content, etc).",
            "Respecting others, whether they are regular members or part of the technical support team for the bot.",
        ];

        const embeds = rules.map((rule, index) => {
            return new EmbedBuilder()
                .setColor("#ee3c37")
                .setTitle(`Rule #${index + 1}`)
                .setDescription(rule);
        });

        const initialEmbed = new EmbedBuilder()
            .setColor("#ee3c37")
            .setTitle("ProMcBot Rules")
            .setDescription("**<:dev:1252930632976175136> Please follow all the rules to avoid any authorized penalties from the bot and the support team.**")
            .setThumbnail(client.user.displayAvatarURL());

        embeds.unshift(initialEmbed);

        message.delete();

        // تقسيم الـ embeds إلى مجموعات بحد أقصى 10 لكل مجموعة
        const chunks = [];
        for (let i = 0; i < embeds.length; i += 10) {
            chunks.push(embeds.slice(i, i + 10));
        }

        for (const chunk of chunks) {
            await channel.send({ embeds: chunk });
        }
    }
});

const whitelist = ['']; // ضع معرفات المستخدمين الذين لديهم صلاحية حذف القنوات
const logChannelId = '1059815220278734889'; // معرف قناة السجلات
const targetGuildId = '1059183076636372993'; // معرف السيرفر المحدد

/*client.on('channelDelete', async (channel) => {
    if (channel.guild.id !== targetGuildId) return; // التحقق من معرف السيرفر

    const fetchedLogs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: 12, // الرقم الصحيح لنوع الحدث CHANNEL_DELETE
    });
    const deletionLog = fetchedLogs.entries.first();

    if (!deletionLog) {
        console.log('No audit log found for channel deletion');
        return;
    }

    const { executor } = deletionLog;

    if (!whitelist.includes(executor.id)) {
        // إعادة إنشاء القناة بنفس الإعدادات
        try {
            const newChannel = await channel.guild.channels.create({
                name: channel.name,
                type: channel.type,
                parent: channel.parent ? channel.parentId : null,
                topic: channel.topic,
                position: channel.rawPosition,
                nsfw: channel.nsfw,
                rateLimitPerUser: channel.rateLimitPerUser,
                reason: 'Channel protection',
            });

            // نسخ الأذونات
            const permissions = channel.permissionOverwrites.cache.map(overwrite => ({
                id: overwrite.id,
                allow: overwrite.allow.toArray(),
                deny: overwrite.deny.toArray(),
            }));
            await newChannel.permissionOverwrites.set(permissions);

            // نسخ الرسائل من القناة المحذوفة إلى القناة الجديدة باستخدام webhook
            const webhook = await newChannel.createWebhook({
                name: 'Channel Restoration Webhook',
                avatar: client.user.displayAvatarURL(), // يمكن تحديد صورة شخصية للـ webhook هنا إذا أردت
            });

            const messages = await channel.messages.fetch({ limit: 100 }); // جلب أحدث 100 رسالة
            for (const message of messages.values()) {
                await webhook.send({
                    content: message.content,
                    username: message.author.username,
                    avatarURL: message.author.displayAvatarURL(),
                    embeds: message.embeds,
                    files: message.attachments.map(att => att.url),
                });
            }

            // حذف webhook بعد الاستخدام
            await webhook.delete();

            console.log(`Recreated channel ${channel.name} with permissions and copied messages`);
        } catch (error) {
            console.error('Error creating channel or copying messages:', error);
        }
    }
});*/


client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const { guild, content, member } = message;
    if (!guild) {
        return;
    }

    try {
        // جلب الردود التلقائية من قاعدة البيانات
        const autoResponders = await AutoResponder.find({ guildId: guild.id });

        if (autoResponders.length === 0) {
            return;
        }

        for (const autoResponder of autoResponders) {
            if (content.includes(autoResponder.trigger)) {
                const allowedRoles = autoResponder.allowedRoles.filter(role => role);
                const disallowedRoles = autoResponder.disallowedRoles.filter(role => role);

                const memberRoles = member.roles.cache.map(role => role.id);
                const hasAllowedRole = allowedRoles.length === 0 || allowedRoles.some(role => memberRoles.includes(role));
                const hasDisallowedRole = disallowedRoles.length > 0 && disallowedRoles.some(role => memberRoles.includes(role));

                if (hasAllowedRole && !hasDisallowedRole) {
                    if (autoResponder.replyType === 'reply') {
                        await message.reply(autoResponder.response);
                    } else {
                        await message.channel.send(autoResponder.response);
                    }
                    break; // بعد إرسال الرد، خروج من الحلقة
                }
            }
        }
    } catch (error) {
        console.error('Error fetching auto responders:', error);
    }
});



const embedMessages = JSON.parse(fs.readFileSync(__dirname + '/../public/json/embedMessages.json', 'utf8'));

const logTypes = Object.keys(embedMessages);

// Connect to MongoDB
async function sendLog(guildId, logType, placeholders) {
    const logSetting = await Log.findOne({ serverId: guildId, 'logs.logType': logType });
    if (!logSetting) return;

    const logConfig = logSetting.logs.find(log => log.logType === logType);
    if (!logConfig) return;

    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.resolve(logConfig.logChannelId);
    if (!channel) return;

    const template = embedMessages[logType];
    if (!template) return;

    let description = template.description;
    for (const [key, value] of Object.entries(placeholders)) {
        description = description.replace(`{${key}}`, value);
    }

    const embed = new EmbedBuilder()
        .setColor(logConfig.embedColor || '#FFFFFF')
        .setTitle(template.title)
        .setDescription(description)
        .setTimestamp(new Date())
        .setFooter({ text: template.footer.text, iconURL: template.footer.iconURL });

    if (template.thumbnail && typeof template.thumbnail.url === 'string' && isValidURL(template.thumbnail.url)) {
        embed.setThumbnail(template.thumbnail.url);
    }

    template.fields.forEach(field => {
        let value = field.value;
        for (const [key, valuePlaceholder] of Object.entries(placeholders)) {
            value = value.replace(`{${key}}`, valuePlaceholder);
        }
        embed.addFields({ name: field.name, value: value, inline: field.inline });
    });

    await channel.send({ embeds: [embed] });
}

// Function to validate URL
function isValidURL(url) {
    try {
        new URL(url);
        return true;
    } catch (_) {
        return false;
    }
}

async function handlePartialMessage(message) {
    try {
        if (message.partial) await message.fetch();
    } catch (error) {
        if (error.message.includes('Unknown Message')) {
            const auditLogs = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 1 });
            const deletionLog = auditLogs.entries.first();
            if (deletionLog) {
                const { executor, target, extra } = deletionLog;
                if (target.id === message.id) {
                    const placeholders = {
                        author: extra.channel.name,
                        authorId: executor.id,
                        channel: extra.channel.name,
                        content: 'Unknown (possibly too old)'
                    };
                    await sendLog(message.guild.id, 'MessageDelete', placeholders);
                }
            }
        }
    }
}

// Event: Message Delete
client.on('messageDelete', async message => {
    await handlePartialMessage(message);
    if (!message.author) return;
    const placeholders = {
        author: message.author.tag,
        authorId: message.author.id,
        channel: message.channel.name,
        content: message.content || 'Embed/Attachment'
    };
    await sendLog(message.guild.id, 'MessageDelete', placeholders);
});

// Event: Message Update
client.on('messageUpdate', async (oldMessage, newMessage) => {
    await handlePartialMessage(oldMessage);
    await handlePartialMessage(newMessage);
    if (!oldMessage.author || !newMessage.author) return;
    const placeholders = {
        author: oldMessage.author.tag,
        authorId: oldMessage.author.id,
        channel: oldMessage.channel.name,
        oldContent: oldMessage.content || 'Embed/Attachment',
        newContent: newMessage.content || 'Embed/Attachment'
    };
    await sendLog(oldMessage.guild.id, 'MessageUpdate', placeholders);
});

// Event: Guild Member Add
client.on('guildMemberAdd', async member => {
    const placeholders = {
        member: `<@${member.id}>`,
        avatarURL: member.user.displayAvatarURL()
    };
    await sendLog(member.guild.id, 'GuildMemberAdd', placeholders);
});

// Event: Guild Member Remove
client.on('guildMemberRemove', async member => {
    const placeholders = {
        member: `<@${member.id}>`,
        avatarURL: member.user.displayAvatarURL()
    };
    await sendLog(member.guild.id, 'GuildMemberRemove', placeholders);
});

// Event: Role Create
client.on('roleCreate', async role => {
    const placeholders = {
        role: role.name,
        iconURL: role.guild.iconURL()
    };
    await sendLog(role.guild.id, 'RoleCreate', placeholders);
});

// Event: Role Delete
client.on('roleDelete', async role => {
    const placeholders = {
        role: role.name,
        iconURL: role.guild.iconURL()
    };
    await sendLog(role.guild.id, 'RoleDelete', placeholders);
});

// Event: Guild Ban Add
client.on('guildBanAdd', async (ban) => {
    const placeholders = {
        member: `<@${ban.user.id}>`,
        avatarURL: ban.user.displayAvatarURL()
    };
    await sendLog(ban.guild.id, 'GuildBanAdd', placeholders);
});

// Event: Guild Ban Remove
client.on('guildBanRemove', async (ban) => {
    const placeholders = {
        member: `<@${ban.user.id}>`,
        avatarURL: ban.user.displayAvatarURL()
    };
    await sendLog(ban.guild.id, 'GuildBanRemove', placeholders);
});

// Event: Channel Create
client.on('channelCreate', async channel => {
    const placeholders = {
        channel: channel.name,
        iconURL: channel.guild.iconURL()
    };
    await sendLog(channel.guild.id, 'ChannelCreate', placeholders);
});

// Event: Channel Delete
client.on('channelDelete', async channel => {
    const placeholders = {
        channel: channel.name,
        iconURL: channel.guild.iconURL()
    };
    await sendLog(channel.guild.id, 'ChannelDelete', placeholders);
});

// Event: Emoji Create
client.on('emojiCreate', async emoji => {
    const placeholders = {
        emoji: emoji.name,
        emojiURL: emoji.url
    };
    await sendLog(emoji.guild.id, 'EmojiCreate', placeholders);
});

// Event: Emoji Delete
client.on('emojiDelete', async emoji => {
    const placeholders = {
        emoji: emoji.name,
        emojiURL: emoji.url
    };
    await sendLog(emoji.guild.id, 'EmojiDelete', placeholders);
});

// Event: Voice State Update (Join/Leave/Move)
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!oldState.channel && newState.channel) {
        // User joined a voice channel
        const placeholders = {
            memberId: newState.member.id,
            channel: newState.channel.name,
            avatarURL: newState.member.user.displayAvatarURL()
        };
        await sendLog(newState.guild.id, 'VoiceStateUpdateJoin', placeholders);
    } else if (oldState.channel && !newState.channel) {
        // User left a voice channel
        const placeholders = {
            memberId: oldState.member.id,
            channel: oldState.channel.name,
            avatarURL: oldState.member.user.displayAvatarURL()
        };
        await sendLog(oldState.guild.id, 'VoiceStateUpdateLeave', placeholders);
    } else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        // User moved to another voice channel
        const placeholders = {
            memberId: oldState.member.id,
            oldChannel: oldState.channel.name,
            newChannel: newState.channel.name,
            avatarURL: oldState.member.user.displayAvatarURL()
        };
        await sendLog(oldState.guild.id, 'VoiceStateUpdateMove', placeholders);
    }
});

// أمر لتحديد قناة الترحيب
client.on('messageCreate', async message => {
    if (message.content.startsWith('!set-welcomer') && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const args = message.content.split(' ');
        if (args[1]) {
            const channelId = args[1].replace('<#', '').replace('>', '');
            const channel = message.guild.channels.cache.get(channelId);
            if (channel) {
                await WelcomeChannel.findOneAndUpdate(
                    { guildId: message.guild.id },
                    { channelId: channelId },
                    { upsert: true }
                );
                message.channel.send(`Welcome channel set to ${channel}`);
            } else {
                message.channel.send('Invalid channel.');
            }
        } else {
            message.channel.send('Please mention a channel.');
        }
    }
});

client.on('messageCreate', message => {
    if (message.content === '!presence' && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const presence = message.member.presence;
        if (presence) {
            const activities = presence.activities.map(activity => activity.name).join(', ');
            message.channel.send(`${message.member.user.tag} is currently ${presence.status} and doing: ${activities}`);
        } else {
            message.channel.send(`${message.member.user.tag} has no presence information.`);
        }
    }
});



/*Chart.register(...registerables);
let stats;
client.once("ready", () => {
  setInterval(updateDailyMaxCount, 60 * 1000); // تحديث الإحصائيات كل 12 ساعة
  updateDailyMaxCount(); // تحديث العدد عند بدء التشغيل
});

async function updateDailyMaxCount() {
  const guilds = client.guilds.cache;
  const now = new Date();
  const dateString = now.toISOString().split('T')[0]; // استخدام التاريخ فقط كجزء من المفتاح الفريد

  for (const guild of guilds.values()) {
    const serverInfo = await ServerInfo.findOne({ serverId: guild.id });
    if (!serverInfo) {
      continue;
    }

    stats = await getServerStats(serverInfo, `${ServerInfo.serverType}`); // Assuming default as "java"
    if (!stats || !stats.players) {
      continue;
    }

    const memberCount = stats.players.online;

    // تحديث أو إنشاء سجل جديد
    await DailyCount.findOneAndUpdate(
      { guildId: guild.id, date: dateString },
      { guildId: guild.id, date: dateString, maxCount: memberCount },
      { upsert: true, new: true }
    );
  }
}

client.on("messageCreate", async (message) => {
  if (message.content.startsWith("!dailycount")) {
    const args = message.content.split(" ");
    const serverType = args[1] || "java";

    const guildId = message.guild.id;
    const data = await DailyCount.find({ guildId }).sort({ date: 1 }).limit(15).exec();

    const membership = await Servermembership.findOne({ Id: guildId });
    const serverInfo = await ServerInfo.findOne({ serverId: guildId });

    if (!serverInfo) {
      return message.reply("Server information not found.");
    }

    stats = await getServerStats(serverInfo, serverType);
    if (!stats.online) {
      return message.reply("Server is offline or there is an issue with retrieving data.");
    }

    // التحقق من تغير الـIP وإعادة تعيين البيانات إذا تغير
    if (serverInfo.javaIP !== stats.javaIP || serverInfo.bedrockIP !== stats.bedrockIP) {
      await DailyCount.deleteMany({ guildId });
      await ServerInfo.updateOne({ serverId: guildId }, { javaIP: stats.javaIP, bedrockIP: stats.bedrockIP });
    }

    let image;
    if (membership && membership.ismembership) {
      image = await createGraphImage(data);
    } else {
      image = await getImageFromUrl('https://i.ibb.co/54RKd6M/blurred.png');
    }

    const attachment = new AttachmentBuilder(image, 'ProMcBot-daily-player-counter.png');

    const embed = new EmbedBuilder()
      .setTitle(`Daily Player Count - ${serverType.toUpperCase()}`)
      .setImage("attachment://ProMcBot-daily-player-counter.png")
      .setColor(membership && membership.ismembership ? "#3fb3d8" : "#FFD700")
      .setDescription(`Current players: ${stats.players.online}/${stats.players.max}`);

    if (!membership || !membership.ismembership) {
      embed.setDescription("Membership required");
    }

    const components = [];
    if (serverType === "custom") {
      const switchButton = new ButtonBuilder()
        .setCustomId(`switch_${serverType === "java" ? "bedrock" : "java"}`)
        .setLabel(`Switch to ${serverType === "java" ? "Bedrock" : "Java"}`)
        .setStyle(ButtonStyle.Primary);
      components.push(new ActionRowBuilder().addComponents(switchButton));
    }

    return message.reply({ embeds: [embed], files: [attachment], components });
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, serverType] = interaction.customId.split("_");

  if (action !== "switch") return;

  const guildId = interaction.guild.id;
  const data = await DailyCount.find({ guildId }).sort({ date: 1 }).limit(15).exec();

  const membership = await Servermembership.findOne({ Id: guildId });
  const serverInfo = await ServerInfo.findOne({ serverId: guildId });

  if (!serverInfo) {
    return interaction.reply("Server information not found.");
  }

  stats = await getServerStats(serverInfo, serverType);
  if (!stats.online) {
    return interaction.reply("Server is offline or there is an issue with retrieving data.");
  }

  let image;
  if (membership && membership.ismembership) {
    image = await createGraphImage(data);
  } else {
    image = await getImageFromUrl('https://i.ibb.co/54RKd6M/blurred.png');
  }

  const attachment = new AttachmentBuilder(image, 'ProMcBot-daily-player-counter.png');

  const embed = new EmbedBuilder()
    .setTitle(`Daily Player Count - ${serverType.toUpperCase()}`)
    .setImage("attachment://ProMcBot-daily-player-counter.png")
    .setColor(membership && membership.ismembership ? "#3fb3d8" : "#FFD700")
    .setDescription(`Current players: ${stats.players.online}/${stats.players.max}`);

  if (!membership || !membership.ismembership) {
    embed.setDescription("Membership required");
  }

  const components = [];
  if (serverType === "custom") {
    const switchButton = new ButtonBuilder()
      .setCustomId(`switch_${serverType === "java" ? "bedrock" : "java"}`)
      .setLabel(`Switch to ${serverType === "java" ? "Bedrock" : "Java"}`)
      .setStyle(ButtonStyle.Primary);
    components.push(new ActionRowBuilder().addComponents(switchButton));
  }

  return interaction.update({ embeds: [embed], files: [attachment], components });
});

async function getServerStats(serverInfo, serverType) {
  const url = `https://api.mcsrvstat.us/3/${serverType === "java" ? serverInfo.javaIP : serverInfo.bedrockIP}`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Error fetching server stats:", error);
    return { online: false };
  }
}

async function getImageFromUrl(url) {
  const response = await axios({
    url,
    responseType: 'arraybuffer'
  });
  return Buffer.from(response.data, 'binary');
}

async function createGraphImage(data) {
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext('2d');

  const labels = data.map(d => DateTime.fromISO(d.date).toFormat('yyyy-MM-dd HH:mm:ss'));
  const values = data.map(d => d.maxCount);

  const maxPlayerCount = Math.max(...values);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderColor: '#3fb3d8',
          backgroundColor: '#3fb3d8',
          borderWidth: 3,
          tension: 0.1,
        }
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Daily Player Count',
          font: {
            size: 24
          },
          color: '#3fb3d8'
        },
        subtitle: {
          display: true,
          text: 'Powered by ProMcBot',
          font: {
            size: 18
          }
        },
        legend: {
          display: false
        }
      },
      responsive: true,
      hover: {
        mode: 'nearest'
      },
      tooltips: {
        mode: 'nearest',
        intersect: true
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: maxPlayerCount + Math.ceil(maxPlayerCount / 10),
          grid: {
            display: true,
            color: '#90EE90'
          },
          ticks: {
            stepSize: Math.ceil(maxPlayerCount / 10) || 1,
            color: '#3fb3d8',
            font: {
              size: 20
            }
          }
        },
        x: {
          grid: {
            display: true,
            color: '#90EE90'
          },
          ticks: {
            color: '#3fb3d8',
            font: {
              size: 16
            }
          }
        }
      }
    }
  });

  return canvas.toBuffer();
}
*/
// Titles:
// ProMcBot Support Rules
// Rule #1 – Bot Invitation
// Rule #2 – Misuse Disclaimer
// Rule #3 – Premium Abuse
// Rule #4 – Support Channel
// Rule #5 – Respect Others
client.on('messageCreate', async (message) => {
  // ignore bots
  if (message.author.bot) return;

  // trigger on exact command
  if (message.content.startsWith("rules1") && message.author.id === "804999528129363998") {
      await message.delete();
    // send plain-text list of rules
    await message.channel.send(
      `## **Please take a moment to review our guidelines :book:**\n` +
      `**1. Bot Invitation** Do not invite the bot to servers that violate Discord's rules.\n` +
      `**2. Misuse Disclaimer** We are not responsible for any misuse of the bot.\n` +
      `**3. Premium Abuse** Do not exploit vulnerabilities to extend Premium membership.\n` +
      `**4. Support Channel** Use only the official support channels for inquiries.\n` +
      `**5. Respect Others** Always treat staff and members with courtesy and respect.\n\n` + `**:link: We follow Discord’s ToS and Community Guidelines:**\n\n- [Terms of Service](https://discord.com/terms)  \n- [Community Guidelines](https://discord.com/guidelines)\n\n:warning: For help, please head to the support channels.`
    );
      await message.channel.send(`## **⚠️ Legal Warning: Intellectual Property Rights**\n\n` + `Copying or replicating the bot, its commands, support system, or any of its designs in any form is strictly prohibited. Any violation of these rights may result in legal action under applicable copyright and intellectual property laws.`);
  }
});




/*client.on('messageCreate', async (message) => {
  if (message.content === '!createCard') {
    try {
      // Load the custom background image (uploaded by user)
      const background = await Jimp.read('./card1.png'); // Ensure path to uploaded file is correct
      background.resize(800, 400); // Resize the background image to the desired size

      // Load the font for text
      const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

      // Add the text to the card
      background.print(font, 30, 30, 'Ray System', 300); // Logo text
      background.print(font, 30, 100, '@ABNER', 300); // Username text
      background.print(font, 30, 200, 'شكرا لتقييمك!', 300); // Thank you text in Arabic
      background.print(font, 500, 250, '10/10', 100); // Rating text

      // Add stars - Simple representation of stars (you can create custom images for stars if needed)
      background.print(font, 500, 200, '⭐⭐⭐', 100); // Rating stars

      // Add a profile picture - this is just a placeholder
      const avatar = await Jimp.read('https://i.imgur.com/AKxfn3C.png'); // Replace with the user profile image URL
      avatar.resize(50, 50); // Resize the avatar to a small size
      background.composite(avatar, 700, 300); // Place it on the card

      // Define the output file path (use a relative path for your environment)
      const outputDirectory = path.join(__dirname, 'generated_cards');
      if (!fs.existsSync(outputDirectory)) {
        fs.mkdirSync(outputDirectory); // Create the directory if it doesn't exist
      }

      const outputFilePath = path.join(outputDirectory, '../card.png'); // Save the file in the generated_cards folder

      // Save the image
      await background.writeAsync(outputFilePath);

      // Check if the file exists before sending
      if (fs.existsSync(outputFilePath)) {
        const attachment = new AttachmentBuilder(outputFilePath);
        message.channel.send({ content: 'Here is your card:', files: [attachment] });

        // You can remove the line below if you do not want to delete the file after sending it
        // fs.unlinkSync(outputFilePath);  // Remove this line if you do not want to delete the file
      } else {
        message.channel.send('Failed to generate the card. Please try again later.');
      }
    } catch (error) {
      console.error('Error creating card:', error);
      message.channel.send('There was an error creating the card.');
    }
  }
});


require('events').EventEmitter.defaultMaxListeners = 20;


// Font cache
const fonts = {
  sans32: null,
  sans24: null,
  sans16: null
};

// Load fonts at startup
async function loadFonts() {
  try {
    console.log('⏳ Loading fonts...');
    
    // Get font paths from jimp module
    const fontBase = path.join(require.resolve('jimp'), '..', '..', 'fonts');
    
    fonts.sans32 = await Jimp.loadFont(
      path.join(fontBase, 'fnt', 'fnt_sans_32_black', 'fnt.fnt')
    );
    
    fonts.sans24 = await Jimp.loadFont(
      path.join(fontBase, 'fnt', 'fnt_sans_24_black', 'fnt.fnt')
    );
    
    fonts.sans16 = await Jimp.loadFont(
      path.join(fontBase, 'fnt', 'fnt_sans_16_white', 'fnt.fnt')
    );
    
    console.log('✅ Fonts loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load fonts:', error);
    throw error;
  }
}

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await loadFonts();
  console.log('🚀 Bot is ready!');
});

client.on('messageCreate', async (message) => {
  if (message.content === '!ssr') {
    try {
      const user = message.author;
      if (user.bot) return;
      
      console.log(`🔄 Generating status for ${user.username}`);
      const username = `${user.username}#${user.discriminator}`;
      
      // Create base image
      const image = await new Jimp(800, 360, 0x1e1f22ff);
      
      // Fetch avatar with axios
      const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256 });
      const response = await axios.get(avatarURL, { responseType: 'arraybuffer' });
      const avatarBuffer = Buffer.from(response.data);
      
      // Process avatar
      const avatar = await Jimp.read(avatarBuffer);
      avatar.resize(170, 170);
      
      // Create circular mask
      const mask = new Jimp(170, 170, 0x00000000);
      mask.scan(0, 0, mask.bitmap.width, mask.bitmap.height, (x, y, idx) => {
        const distance = Math.sqrt(Math.pow(x - 85, 2) + Math.pow(y - 85, 2));
        mask.bitmap.data[idx + 3] = distance <= 85 ? 255 : 0;
      });
      
      avatar.mask(mask);
      
      // Composite avatar
      image.composite(avatar, 315, 60);
      
      // Draw status UI
      await drawStatusUI(image, username);
      
      // Send image
      const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
      await message.channel.send({
        content: `Here's your account status, ${user.username}!`,
        files: [new AttachmentBuilder(buffer, { name: 'status.png' })]
      });
      
      console.log(`✅ Status sent for ${user.username}`);
    } catch (error) {
      console.error('❌ Error generating status image:', error);
      message.channel.send('❌ Error generating your status image. Please try again later.');
    }
  }
});

async function drawStatusUI(image, username) {
  // Draw username
// const username = "User#1234"; // Placeholder - will be replaced
  image.print(
    fonts.sans32,
    400 - (Jimp.measureText(fonts.sans32, username) / 2),
    280,
    username
  );
  
  // Draw status text
  const statusText = "Your account is all good";
  const textX = 400 - (Jimp.measureText(fonts.sans24, statusText) / 2);
  image.print(fonts.sans24, textX, 320, statusText);
  
  // Color "all good" in green
  const prefix = "Your account is ";
  const greenStart = textX + Jimp.measureText(fonts.sans24, prefix);
  const greenWidth = Jimp.measureText(fonts.sans24, "all good");
  
  image.scan(greenStart, 320, greenWidth, 30, (x, y, idx) => {
    if (image.bitmap.data[idx + 3] > 0) {
      image.bitmap.data[idx] = 0x3b;     // R
      image.bitmap.data[idx + 1] = 0xa5; // G
      image.bitmap.data[idx + 2] = 0x5c; // B
    }
  });
  
  // Draw progress indicators
  const y = 200;
  const colors = [0x3ba55cff, 0x4f545cff, 0x4f545cff, 0x4f545cff, 0x4f545cff];
  
  // Draw connecting lines
  for (let i = 0; i < 4; i++) {
    const x1 = 150 + (i * 150) + 30;
    const x2 = 150 + ((i + 1) * 150) - 30;
    drawLine(image, x1, y, x2, y, 0x4f545cff, 3);
  }
  
  // Draw status circles
  for (let i = 0; i < 5; i++) {
    const x = 150 + (i * 150);
    drawCircle(image, x, y, 20, colors[i]);
    
    // Draw checkmark in first circle
    if (i === 0) {
      drawLine(image, x - 7, y, x - 2, y + 7, 0xffffffff, 3);
      drawLine(image, x - 2, y + 7, x + 8, y - 7, 0xffffffff, 3);
    }
  }
}

function drawCircle(image, cx, cy, radius, color) {
  image.scan(cx - radius, cy - radius, radius * 2, radius * 2, (x, y, idx) => {
    const distance = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
    if (distance <= radius) {
      image.bitmap.data[idx] = (color >> 24) & 0xFF;
      image.bitmap.data[idx + 1] = (color >> 16) & 0xFF;
      image.bitmap.data[idx + 2] = (color >> 8) & 0xFF;
      image.bitmap.data[idx + 3] = color & 0xFF;
    }
  });
}

function drawLine(image, x1, y1, x2, y2, color, width) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  for (let i = 0; i < distance; i++) {
    const t = i / distance;
    const x = Math.round(x1 + dx * t);
    const y = Math.round(y1 + dy * t);
    
    for (let w = -width; w <= width; w++) {
      for (let h = -width; h <= width; h++) {
        if (x + w >= 0 && x + w < image.bitmap.width && 
            y + h >= 0 && y + h < image.bitmap.height) {
          const idx = ((y + h) * image.bitmap.width + (x + w)) * 4;
          image.bitmap.data[idx] = (color >> 24) & 0xFF;
          image.bitmap.data[idx + 1] = (color >> 16) & 0xFF;
          image.bitmap.data[idx + 2] = (color >> 8) & 0xFF;
          image.bitmap.data[idx + 3] = color & 0xFF;
        }
      }
    }
  }
}

    
const blockedExtensions = decodeList(['2e657865', '2e626174', '2e7368', '2e7a6970', '2e726172', '2e6d7369']);
const blockedKeywords = decodeList(['6c6f63616c686f7374', '3132372e302e302e31', '66696c653a2f2f', '696e7465726e616c', '6674703a2f2f']);
const blockedAdultDomains = decodeList([
    '706f726e', '736578', '78766964656f73', '786e7878', '72656474756265', '796f756a697a7a', '6272617a7a657273',
    '7868616d73746572', '68656e746169', '72756c653334', '63616d6769726c', '63616d34', '6164756c74', '31382b',
    '6e756465', '666170', '706c6179626f79', '6e736677', '6f6e6c7966616e73', '65726f746963'
]);



client.on('messageCreate', async message => {
    if (!message.content.startsWith('!myp')) return;
    const args = message.content.split(' ');
    const urlInput = `${url}/u/${args[1]}`;

    if (!urlInput || !urlInput.startsWith('http')) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setDescription('⚠️ Please provide a valid URL.\nExample: `!screenshot https://example.com`')
                    .setFooter({ text: 'Code By **Zeo** | discord.gg/bvBM63SwJn', iconURL: client.user.displayAvatarURL() })
            ]
        });
    }

    const statusEmbed = await message.channel.send({
        embeds: [
            new EmbedBuilder()
                .setColor('Yellow')
                .setDescription('🔍 Scanning and checking the website...')
                .setFooter({ text: 'Code By **Zeo** | discord.gg/bvBM63SwJn', iconURL: client.user.displayAvatarURL() })
        ]
    });

    try {
        const url = new URL(urlInput);
        const lowerUrl = url.href.toLowerCase();

        if (blockedAdultDomains.some(word => lowerUrl.includes(word)))
            return statusEmbed.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('🚫 This website is blocked due to adult content.')
                        .setFooter({ text: 'Code By **Zeo** | discord.gg/bvBM63SwJn', iconURL: client.user.displayAvatarURL() })
                ]
            });

        if (blockedKeywords.some(k => lowerUrl.includes(k)))
            return statusEmbed.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('🚫 This URL is not allowed for safety reasons.')
                        .setFooter({ text: 'Code By **Zeo** | discord.gg/bvBM63SwJn', iconURL: client.user.displayAvatarURL() })
                ]
            });

        if (blockedExtensions.some(ext => url.pathname.endsWith(ext)))
            return statusEmbed.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('🚫 This URL points to a potentially dangerous file and is blocked.')
                        .setFooter({ text: 'Code By **Zeo** | discord.gg/bvBM63SwJn', iconURL: client.user.displayAvatarURL() })
                ]
            });

        const hostname = url.hostname;
        const isIP = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
      /*  if (isIP || hostname === 'localhost') {
            return statusEmbed.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('🚫 IP-based URLs or localhost are not allowed.')
                        .setFooter({ text: 'Code By **Zeo** | discord.gg/bvBM63SwJn', iconURL: client.user.displayAvatarURL() })
                ]
            });
        }*

        try {
            await dns.lookup(hostname);
        } catch {
            return statusEmbed.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription(`❌ Cannot resolve domain name \`${hostname}\`.`)
                        .setFooter({ text: 'Code By **Zeo** | discord.gg/bvBM63SwJn', iconURL: client.user.displayAvatarURL() })
                ]
            });
        }

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115 Safari/537.36');
        await page.setRequestInterception(true);
        page.on('request', request => request.continue());

        const response = await page.goto(url.href, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        if (!response || response.status() >= 400) {
            await browser.close();
            return statusEmbed.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription(`❌ Failed to access the website. Status code: ${response?.status() || 'Unknown'}`)
                        .setFooter({ text: 'Code By **Zeo** | discord.gg/bvBM63SwJn', iconURL: client.user.displayAvatarURL() })
                ]
            });
        }

        const bodyText = await page.evaluate(() => document.body.innerText);
        if (
            bodyText.includes('Access Denied') ||
            bodyText.includes('Forbidden') ||
            bodyText.includes('Captcha') ||
            bodyText.toLowerCase().includes('verify you are human')
        ) {
            await browser.close();
            return statusEmbed.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('🚫 Website is protected or requires human verification. Screenshot not possible.')
                        .setFooter({ text: 'Code By **Zeo** | discord.gg/bvBM63SwJn', iconURL: client.user.displayAvatarURL() })
                ]
            });
        }

        await new Promise(resolve => setTimeout(resolve, 5000));
        const screenshotBuffer = await page.screenshot({ fullPage: false });
        const attachment = new AttachmentBuilder(screenshotBuffer, { name: 'screenshot.png' });
        await browser.close();

        return statusEmbed.edit({
            content: '',
            embeds: [
                new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('📸 Screenshot Taken')
                    .setDescription(`[Click here to visit website](${url.href})`)
                    .setImage('attachment://screenshot.png')
                    .setFooter({ text: 'Code By **Zeo** | discord.gg/bvBM63SwJn', iconURL: client.user.displayAvatarURL() })
            ],
            files: [attachment]
        });
    } catch (err) {
        console.error('❌ Error:', err);
        return statusEmbed.edit({
            embeds: [
                new EmbedBuilder()
                    .setColor('Red')
                    .setDescription('❌ An error occurred while processing the website.')
                    .setFooter({ text: 'Code By **Zeo** | discord.gg/bvBM63SwJn', iconURL: client.user.displayAvatarURL() })
            ]
        });
    }
});
   */

const SKIN_STYLES = [
  'default',
  'marching',
  'walking',
  'crouching',
  'crossed',
  'crissCross',
  'cheering',
  'relaxing',
  'trudging',
  'cowering',
  'pointing',
  'lunging',
  'dungeons',
  'facepalm',
  'sleeping',
  'dead',
  'archer',
  'mojavatar',
  'ultimate',
  'isometric',
  'head',
  'bitzel',
  'pixel',
  'ornament',
  'skin'
];
client.on('messageCreate', async message => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'randomskin') {
    try {
      // Select random style
      const randomStyle = SKIN_STYLES[Math.floor(Math.random() * SKIN_STYLES.length)];
      
      // API request using default player name (Steve)
      const response = await axios.get(`https://starlightskins.lunareclipse.studio/render/${randomStyle}/steve/full`);

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`Steve's Skin`)
        .setDescription(`**Style:** ${randomStyle}`)
        .setColor('#5865F2')
        .setImage('attachment://skin.png');

      // Send message with attachment
      await message.channel.send({
        embeds: [embed],
        files: [{
          attachment: response.data,
          name: 'skin.png'
        }]
      });
    } catch (error) {
      console.error(error);
      await message.reply('Failed to fetch skin. Please try again later.');
    }
  }
    if (command === 'rp') {
    try {
      // Check if player name is provided
      if (!args[0]) {
        await message.reply('Please provide a player name (e.g., !rp hemo0)');
        return;
      }

      const playerName = args[0];
      
      // Select random style
      const randomStyle = SKIN_STYLES[Math.floor(Math.random() * SKIN_STYLES.length)];
      
      // API request with specified player name
      const response = await axios.get(`https://starlightskins.lunareclipse.studio/render/${randomStyle}/${playerName}/full`);
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${playerName}'s Skin`)
        .setDescription(`**Style:** ${randomStyle}`)
        .setColor('#5865F2')
      .setImage('attachment://skin.png');

      // Send message with attachment
      await message.channel.send({
        embeds: [embed],
        files: [{
          attachment: response.data,
          name: 'skin.png'
        }]
      });
    } catch (error) {
      console.error(error);
      await message.reply(`Failed to fetch skin for ${args[0]}. Please check the player name and try again.`);
    }
  }
});