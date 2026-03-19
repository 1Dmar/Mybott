require('dotenv-flow').config();
const { 
  Client, Collection, GatewayIntentBits, Partials, EmbedBuilder, 
  PermissionsBitField, WebhookClient, ActionRowBuilder, ButtonBuilder, 
  ButtonStyle, ActivityType, ChannelType
} = require("discord.js");
const express = require('express');
const { chromium } = require("playwright");
const pidusage = require('pidusage');
const {nanoid} = require('nanoid');
const passport = require('passport');
const db = require('pro.db');
const mongoose = require('mongoose');
const DiscordStrategy = require('passport-discord').Strategy;
const session = require('express-session');
const app = express.Router();
const cors = require("cors");
app.use(cors());
const Blacklist = require('../bot/Models/BlackList'); 
const Ticket = require('../bot/Models/Ticket'); //1232223323433 
const BotConfig = require('../bot/Models/BotConfig'); //1233333333343
const Message = require('../bot/Models/Message'); //12233344333333
const User = require('../bot/Models/apiKey'); //122333333334333
const ServerStatus = require('../bot/Models/ServerStatus'); //1223333333
const Membership = require('../bot/Models/User'); 
const AutoResponder = require('../bot/Models/AutoResponder'); 
const Mentions = require('../bot/Models/Mentions');
const Language = require('../bot/Models/Langs');
const ApiKey = require('../bot/Models/Api'); //123333333
const BumpedServer = require('../bot/Models/bumpedServer');
const ServerInfo = require('../bot/Models/Server');
const Log = require('../bot/Models/Log');
const path = require('path');
const http = require('http');
const Vibrant = require('node-vibrant');
const axios = require('axios');
const showdown = require('showdown');
const fs = require ('fs');
const { addFeature, removeFeature, fetchFeatures } = require('../bot/Models/featuresService'); /////12333344334433
const Feature = require('../bot/Models/Feature'); ///123333333
const Jimp = require('jimp');
const getColors = require('get-image-colors');
const WebSocket = require('ws');
const secretKey = "12344";
const server = http.createServer(app);
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const Command = require('../bot/Models/Command');
const webhookClient = new WebhookClient({
  id: '1322151531260284979', token: 'FsQoCxU3C782YYS0SRKNTPKRi8NIgm1hT_JfliwHcgZ4q5M7t586HRArJD9PsnEbszjp'
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ]
});

const client1 = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

const DISCORD_CLIENT_ID= BigInt(1130577557461401622).toString();
const DISCORD_GUILD_ID=BigInt(1226151054178127872).toString();
const MODMAIL_CATEGORY_ID="1273517241622593558";
const newCategoryId = "1273517236610404452";

const antiCrash = require('discord-anticrash')
const noCrash = new antiCrash(client, {
  enableAntiCrash: 'true'
});

app.use(bodyParser.urlencoded({ extended: true }));
mongoose.set("strictQuery", true);

mongoose.connect(process.env.MONGO_URL, {
useNewUrlParser: true,
  useUnifiedTopology: true,
  })
  .then(async () => {
    console.log(`> MongoDB Connected !!`);
  })
  .catch(error => {
    console.error('Error connecting to MongoDB:', error.message);
  });
  
let cpuUsagePercent = 0;
client.on("ready", async () => {
    console.log(`${client.user.username} is Ready`);
     cpuUsagePercent = 0;

    try {
      const stats = await pidusage(process.pid);
      cpuUsagePercent = stats.cpu;
    } catch (error) {
      console.error('خطأ في جلب استهلاك المعالج:', error);
    }
    
    client1.user.setStatus("online");

  const activities = [
    { name: "Moddy | New update! 🚀", type: ActivityType.Playing },
    { name: "Moddy | Powered by ProMcBot! 🔥", type: ActivityType.Playing }
  ];
  
  let i = 0;
  setInterval(() => {
     client1.user.setActivity(activities[i]);
    i = (i + 1) % activities.length;
  }, 10000);
});

app.use(session({
  secret: "nfJ90bf5X2VnFsU8sLGgvZqcDA1Ce9A3",
  resave: false,
  saveUninitialized: false,
}));
app.use(cookieParser());

app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: "nfJ90bf5X2VnFsU8sLGgvZqcDA1Ce9A3",
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 3 * 24 * 60 * 60 * 1000,
            httpOnly: false,
            secure: true,
        },
    })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(
    new DiscordStrategy(
        {
            clientID: "1220005260857311294",
            clientSecret: "KWAY2Bw_eJ4ZVHWDwgoJ3ZRVPAqv9o7G",
            callbackURL: "https://promcbot.qzz.io/auth/discord/callback",
            scope: ["identify", "guilds", "email"],
        },
        async function (accessToken, refreshToken, profile, done) {
            process.nextTick(() => {
                const now = Date.now();
                profile.lastLogin = profile.lastLogin || now;

                const embed = new EmbedBuilder()
                    .setColor("#ffcc00")
                    .setTitle("🔹 **تسجيل دخول جديد!** 🔹")
                    .setThumbnail(`https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`)
                    .addFields(
                        { name: "👤 **الاسم**", value: `${profile.global_name} (${profile.username})`, inline: true },
                        { name: "🆔 **المعرف**", value: profile.id, inline: true },
                        { name: "⏳ **آخر دخول**", value: new Date(profile.lastLogin).toLocaleString(), inline: true },
                        { name: "🕒 **البريد الإلكتروني**", value: profile.email, inline: true },
                        { name: "🔗 **ذكر المستخدم**", value: `<@${profile.id}>`, inline: true }
                    )
                    .setFooter({ text: "🚀 تم تسجيل الدخول بنجاح!", iconURL: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` })
                    .setTimestamp();

                webhookClient.send({ embeds: [embed] });
                profile.lastLogin = now;
                return done(null, profile);
            });
        }
    )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.use((req, res, next) => {
    if (req.isAuthenticated()) {
        req.session.cookie.maxAge += 24 * 60 * 60 * 1000;
    }
    next();
});

app.get('/auth/discord', (req, res, next) => {
  if (req.isAuthenticated()) {
    res.redirect('/');
  } else {
    next();
  }
}, passport.authenticate('discord'));

app.get('/auth/discord/callback',
  passport.authenticate('discord', {
    failureRedirect: '/'
  }),
  (req, res) => res.redirect('/')
);

app.get('/:serverId/premium', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/loading-auth');
  }

  const { username, id, avatar, banner, guilds, global_name, email } = req.user || {};
  const numGuilds = guilds ? guilds.length : 0;
    let numUsers;
        let numServers;
if (client) {
    numUsers = client.users.cache.size;
        numServers = client.guilds.cache.size;
    ping = client.ws.ping;

} else {
    handleError('premium is not available');
}
    const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const numUserss = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
  fs.readFile(__dirname + '/dashboard/pages/premium.html', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return res.status(500).send('Error reading file');
    }

    data = data.replace(/\${userId}/g, id || '');
    data = data.replace(/\${username}/g, username || '');
    data = data.replace(/\${avatar}/g, `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`);
    data = data.replace(/\${email}/g, email );
      data = data.replace(/\${global_name}/g, global_name );
      data = data.replace(/\${banner}/g, `https://cdn.discordapp.com/banners/${id}/${banner}.png?size=1024` || 'https://i.ibb.co/1YZpvv1Y/banner.jpg');
    data = data.replace(/\${numUsers}/g, numUsers || 'Loading...');
    data = data.replace(/\${currentDate}/g, currentDate || '');

    res.send(data);
  });
});

app.get('/:serverId/invite', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/loading-auth');
  }
const serverId = req.params.serverId;

    if (!/^\d+$/.test(serverId)) {
        return res.redirect('/servers');
    }

    const guild = client.guilds.fetch(serverId).catch(() => null);
    if (!guild) {
        return res.redirect('/servers');
    }

  const { username, id, avatar, banner, guilds, global_name, email } = req.user || {};
  const numGuilds = guilds ? guilds.length : 0;
    let numUsers;
        let numServers;
if (client) {
    numUsers = client.users.cache.size;
        numServers = client.guilds.cache.size;
    ping = client.ws.ping;

} else {
    handleError('invite is not available');
}
    const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const numUserss = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
  fs.readFile(__dirname + '/dashboard/pages/invite.html', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return res.status(500).send('Error reading file');
    }

    data = data.replace(/\${userId}/g, id || '');
      data = data.replace(/\${serverId}/g, serverId || '');
    data = data.replace(/\${username}/g, username || '');
    data = data.replace(/\${avatar}/g, `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`);
      data = data.replace(/\${global_name}/g, global_name );
      data = data.replace(/\${banner}/g, `https://cdn.discordapp.com/banners/${id}/${banner}.png?size=1024` || 'https://i.ibb.co/1YZpvv1Y/banner.jpg');
    data = data.replace(/\${numUsers}/g, numUsers || 'Loading...');
    data = data.replace(/\${currentDate}/g, currentDate || '');

    res.send(data);
  });
});

app.get('/:serverId/roles', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/loading-auth');
  }

  const { username, id, avatar, banner, guilds, global_name, email } = req.user || {};
  const numGuilds = guilds ? guilds.length : 0;
    let numUsers;
        let numServers;
if (client) {
    numUsers = client.users.cache.size;
        numServers = client.guilds.cache.size;
    ping = client.ws.ping;

} else {
    handleError('roles is not available');
}
    const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const numUserss = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
  fs.readFile(__dirname + '/dashboard/pages/roles.html', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return res.status(500).send('Error reading file');
    }

    data = data.replace(/\${userId}/g, id || '');
    data = data.replace(/\${username}/g, username || '');
    data = data.replace(/\${avatar}/g, `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`);
    data = data.replace(/\${email}/g, email );
      data = data.replace(/\${global_name}/g, global_name );
      data = data.replace(/\${banner}/g, `https://cdn.discordapp.com/banners/${id}/${banner}.png?size=1024` || 'https://i.ibb.co/1YZpvv1Y/banner.jpg');
    data = data.replace(/\${numUsers}/g, numUsers || 'Loading...');
    data = data.replace(/\${currentDate}/g, currentDate || '');

    res.send(data);
  });
});

app.get('/:serverId/roles/list', async (req, res) => {
  try {
    const guild = client.guilds.cache.get(req.params.serverId);
    if (!guild) return res.status(404).json({ error: 'Server not found' });
    
    const roles = guild.roles.cache
      .sort((a, b) => b.position - a.position)
      .map(role => ({
        id: role.id,
        name: role.name,
        color: role.hexColor,
        position: role.position,
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: role.permissions.toArray(),
        members: role.members.size
      }));
    
    res.json(roles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/:serverId/roles', async (req, res) => {
  try {
    const guild = client.guilds.cache.get(req.params.serverId);
    if (!guild) return res.status(404).json({ error: 'Server not found' });
    
    const { name, color, hoist, mentionable, permissions } = req.body;
    
    const role = await guild.roles.create({
      name,
      color,
      hoist,
      mentionable,
      permissions: permissions || []
    });
    
    res.json({
      id: role.id,
      name: role.name,
      color: role.hexColor,
      position: role.position,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: role.permissions.toArray(),
      members: 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/:serverId/roles/:roleId', async (req, res) => {
  try {
    const guild = client.guilds.cache.get(req.params.serverId);
    if (!guild) return res.status(404).json({ error: 'Server not found' });
    
    const role = guild.roles.cache.get(req.params.roleId);
    if (!role) return res.status(404).json({ error: 'Role not found' });
    
    const { name, color, hoist, mentionable, permissions } = req.body;
    
    if (name) await role.setName(name);
    if (color) await role.setColor(color);
    if (hoist !== undefined) await role.setHoist(hoist);
    if (mentionable !== undefined) await role.setMentionable(mentionable);
    if (permissions) await role.setPermissions(permissions);
    
    res.json({
      id: role.id,
      name: role.name,
      color: role.hexColor,
      position: role.position,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: role.permissions.toArray(),
      members: role.members.size
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/:serverId/roles/:roleId', async (req, res) => {
  try {
    const guild = client.guilds.cache.get(req.params.serverId);
    if (!guild) return res.status(404).json({ error: 'Server not found' });
    
    const role = guild.roles.cache.get(req.params.roleId);
    if (!role) return res.status(404).json({ error: 'Role not found' });
    
    await role.delete();
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use(express.json());

app.post('/sendEmbed', async (req, res) => {
    const { title, description, fields, color, webhookURL, author, footer, content, method } = req.body;

    const embed = new EmbedBuilder()
        .setTitle(title || '')
        .setDescription(description || '')
        .setColor(color || '#000000')
        .setAuthor(author ? { name: author } : null)
        .setFooter(footer ? { text: footer } : null);

    fields.forEach(field => {
        embed.addFields({ name: field.name, value: field.value });
    });

    try {
        if (method === 'webhook') {
            const webhookClient = new WebhookClient({ url: webhookURL });
            await webhookClient.send({
                content: content || '',
                embeds: [embed],
            });
        }
        res.status(200).send('Embed sent successfully!');
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while sending the embed.');
    }
});


app.get('/api/blacklist/:serverId', async (req, res) => {
    try {
        const serverId = req.params.serverId;
        
        if (!serverId) {
            return res.status(400).json({ error: 'Server ID is required' });
        }
        
        const blacklistEntry = await Blacklist.findOne({ guildIds: serverId });
        if (!blacklistEntry) {
            return res.json({ 
                blacklisted: false 
            });
        }

        res.json({
            blacklisted: true,
            reason: blacklistEntry.reason,
            duration: blacklistEntry.duration,
            expiresAt: blacklistEntry.expiresAt,
            permanent: blacklistEntry.isPermanent || false
        });
    } catch (error) {
        console.error('Blacklist check error:', error);
        res.status(500).json({ 
            error: 'Internal server error' 
        });
    }
});


app.get('/api/premium/:serverId', async (req, res) => {
    try {
        const serverId = req.params.serverId;
        
        if (!serverId) {
            return res.status(400).json({ error: 'Server ID is required' });
        }
        
        const serverData = await Membership.findOne({ Id: serverId });
        if (!serverData) {
            return res.status(404).json({ 
                premium: false, 
                message: 'Server not found' 
            });
        }

        res.json({
            premium: serverData.ismembership,
            membership: serverData.membership
        });
    } catch (error) {
        console.error('Premium check error:', error);
        res.status(500).json({ 
            error: 'Internal server error' 
        });
    }
});

app.get('/api/servers', async (req, res) => {
  const servers = await ServerInfo.find();
  const uniqueServers = new Map();

  for (const server of servers) {
    const response = await axios.get(`https://api.mcsrvstat.us/3/${server.javaIP}:${server.javaPort}`);
    const data = response.data;
    const serverKey = `${server.javaIP}:${server.javaPort}`;

    if (!uniqueServers.has(serverKey)) {
      uniqueServers.set(serverKey, {
        serverName: server.serverName,
        javaIP: server.javaIP,
        javaPort: server.javaPort,
        serverType: server.serverType,
        players: data.players ? data.players.online : null,
        maxPlayers: data.players ? data.players.max : null,
        version: data.version ? data.version : null,
        online: data.online ? data.online : false,
        discordServers: [server.serverId]
      });
    } else {
      uniqueServers.get(serverKey).discordServers.push(server.serverId);
    }
  }

  res.json(Array.from(uniqueServers.values()));
});

const SUPPORT_SERVER_ID = "1226151054178127872";

app.get(["/api/u/:id", "/api/user/:id"], async (req, res) => {
    try {
        const userId = req.params.id;
        if (isNaN(userId) || userId.length < 17) {
            return res.status(400).json({ error: "Invalid user ID." });
        }

        const userResponse = await axios.get(`https://discord.com/api/v10/users/${userId}`, {
            headers: { Authorization: `Bot ${TOKEN}` }
        });

        const user = userResponse.data;

        if (user.bot) {
            return res.status(400).json({ error: "Bots are not allowed." });
        }

        const accountCreationDate = new Date(user.id / 4194304 + 1420070400000).toISOString().split("T")[0];
        const isNewAccount = checkNewAccount(accountCreationDate);
        const isAdmin = await checkIfAdmin(userId);
        const isBugH = await checkIfBugH(userId);

        const badges = getBadges(isNewAccount, isAdmin, isBugH);
        const avatar = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=512`;
        let bannerColor = '#7289da';
        if (avatar) {
        const colors = await getColors(avatar);
        bannerColor = colors[0].hex();
      }
        const banner = user.banner ? `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.png?size=1024` : bannerColor;

        res.json({
            id: user.id,
            username: user.username,
            global_name: user.global_name || user.username,
            avatar: avatar,
            banner: banner,
            created_at: accountCreationDate,
            badges: badges,
        });
    } catch (error) {
        res.status(404).json({ error: "User not found." });
    }
});

async function checkIfAdmin(userId) {
    try {
        const guildResponse = await axios.get(`https://discord.com/api/v10/guilds/${SUPPORT_SERVER_ID}/members/${userId}`, {
            headers: { Authorization: `Bot ${TOKEN}` }
        });

        const member = guildResponse.data;
        return member.roles.includes("1226602365335896104");
    } catch {
        return false;
    }
}
async function checkIfBugH(userId) {
    try {
        const guildResponse = await axios.get(`https://discord.com/api/v10/guilds/${SUPPORT_SERVER_ID}/members/${userId}`, {
            headers: { Authorization: `Bot ${TOKEN}` }
        });

        const member = guildResponse.data;
        return member.roles.includes("1226602365335896104");
    } catch {
        return false;
    }
}
function checkNewAccount(creationDate) {
    const accountDate = new Date(creationDate);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return accountDate > threeMonthsAgo;
}

function getBadges(isNew, isAdmin, isBugH) {
    const badges = [
        { name: "User", icon: "https://i.ibb.co/Vc69K6bc/members-icon.png" }
    ];
    
    if (isNew) {
        badges.push({ name: "New Account", icon: "https://i.ibb.co/xSGZHtym/new-member-icon.png" });
    }
    if (isAdmin) {
        badges.push({ name: "Admin", icon: "https://i.ibb.co/LzRzqCrD/staff-icon.png" });
    }
    if (isBugH) {
        badges.push({ name: "Bug Hunter", icon: "https://i.ibb.co/SwjstX3J/bug-hunter-icon.png" });
    }

    return badges;
}

app.get(["/u/:userId", "/user/:userId"], (req, res) => { 
    res.sendFile(path.join(__dirname, "dashboard", "pages", "users.html"));
});

app.post('/sendEmbed', async (req, res) => {
    const { title, description, fields, color, webhookURL, author, footer, content, method } = req.body;

    const embed = new EmbedBuilder()
        .setTitle(title || '')
        .setDescription(description || '')
        .setColor(color || '#000000')
        .setAuthor(author ? { name: author } : null)
        .setFooter(footer ? { text: footer } : null);

    fields.forEach(field => {
        embed.addFields({ name: field.name, value: field.value });
    });

    try {
        if (method === 'webhook') {
            const webhookClient = new WebhookClient({ url: webhookURL });
            await webhookClient.send({
                content: content || '',
                embeds: [embed],
            });
        }
        res.status(200).send('Embed sent successfully!');
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while sending the embed.');
    }
});

app.get('/api/discord-servers', async (req, res) => {
  const { ids } = req.query;
  const serverIds = ids.split(',');

  const discordServers = await Promise.all(serverIds.map(async (id) => {
    const guild = await client.guilds.fetch(id);
    return {
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL()
    };
  }));

  res.json(discordServers);
});

app.get('/dashboard', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/loading-auth');
  }

  const { username, id, avatar, banner, guilds, global_name, email } = req.user || {};
  const numGuilds = guilds ? guilds.length : 0;
    let numUsers;
        let numServers;
if (client) {
    numUsers = client.users.cache.size;
        numServers = client.guilds.cache.size;
    ping = client.ws.ping;

} else {
    handleError('dashboard is not available');
}
    const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const numUserss = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
  fs.readFile(__dirname + '/dashboard/dashboard.html', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return res.status(500).send('Error reading file');
    }

    data = data.replace(/\${userId}/g, id || '');
    data = data.replace(/\${username}/g, username || '');
    data = data.replace(/\${avatar}/g, `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`);
    data = data.replace(/\${ping}/g, ping || '');
    data = data.replace(/\${email}/g, email );
      data = data.replace(/\${global_name}/g, global_name );
      data = data.replace(/\${banner}/g, `https://cdn.discordapp.com/banners/${id}/${banner}.png?size=1024` || 'https://i.ibb.co/1YZpvv1Y/banner.jpg');
    data = data.replace(/\${numUsers}/g, numUsers || 'Loading...');
    data = data.replace(/\${currentDate}/g, currentDate || '');

    res.send(data);
  });
});

app.get('/:serverId/settings', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/loading-auth');
    }
    const serverId = req.params.serverId;
    const { id: userId, username, avatar, global_name } = req.user || {};

    if (!/^\d+$/.test(serverId)) {
        return res.redirect('/servers');
    }
            
    const guild = await client.guilds.fetch(serverId).catch(() => null);
    if (!guild) {
        return res.redirect('/servers');
    }
    
    const ownerId = guild.ownerId;
    const member = await guild.members.fetch(userId).catch(console.error);
    if (!member) {
        console.error(`لم يتم العثور على العضو: ${userId}`);
        return;
    }

    const hasAdminPermission = member.permissions?.has(PermissionsBitField.Flags.Administrator) || false;
    const isOwner = ownerId === userId;
        
    if (!isOwner && !hasAdminPermission) {
        console.log(`User ${userId} is not owner nor admin in guild ${serverId}`);
        return res.redirect('/servers');
    }

    const ServerInfo = require('../bot/Models/Server');
    const ssServer = await ServerInfo.findOne({ serverId });

    const {
        serverName = "No server name set",
        javaIP = "No javaip set",
        javaPort = "No javaport set",
        bedrockIP = "No bedrockip set",
        bedrockPort = "No bedrockport set"
    } = ssServer || {};

    const prefix = await db.get(`settings_${serverId}.prefix`) || ''; 
    const otherSettings = await db.get(`settings_${serverId}.otherSettings`) || {}; 

    fs.readFile(__dirname + '/dashboard/pages/settings.html', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(500).send('Error reading file');
        }

        data = data.replace(/\${userId}/g, userId || '')
                   .replace(/\${serverName}/g, serverName)
        
.replace(/\${global_name}/g, global_name)
                   .replace(/\${javaIP}/g, javaIP)
                   .replace(/\${javaPort}/g, javaPort)
                   .replace(/\${bedrockIP}/g, bedrockIP)
                   .replace(/\${bedrockPort}/g, bedrockPort)
                   .replace(/\${username}/g, username || '')
                   .replace(/\${avatar}/g, `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`)
                   .replace(/\${serverId}/g, serverId || 'ERR');

        res.send(data);
    });
});

app.get('/docs/Introduction', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/loading-auth');
    }
    res.sendFile(path.join(__dirname, '/dashboard/pages/docs/docs.html'));
});

app.get('/:serverId/auto_responder', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/loading-auth');
    }
    const serverId = req.params.serverId;

    const { username, id, avatar, guilds } = req.user || {};

    fs.readFile(__dirname + '/dashboard/pages/auto_responder.html', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(500).send('Error reading file');
        }

        data = data.replace(/\${userId}/g, id || '');
        data = data.replace(/\${username}/g, username || '');
        data = data.replace(/\${avatar}/g, `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`);
        data = data.replace(/\${serverId}/g, serverId || 'ERR');

        res.send(data);
    });
});

app.get('/bugs', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/loading-auth');
    }

    const { username, id, avatar, guilds, email, global_name } = req.user || {};

    fs.readFile(__dirname + '/dashboard/pages/bugs.html', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(500).send('Error reading file');
        }

        data = data.replace(/\${userId}/g, id || '');
        data = data.replace(/\${username}/g, username || '');
        data = data.replace(/\${email}/g, email );
        data = data.replace(/\${global_name}/g, global_name );
        data = data.replace(/\${avatar}/g, `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`);
        data = data.replace(/\${serverId}/g, serverId || 'ERR');

        res.send(data);
    });
});

app.get('/server/:serverId/logs', async (req, res) => {
    const { serverId } = req.params;
    try {
        const log = await Log.findOne({ serverId });
        if (!log) {
            return res.status(404).json({ message: 'Server logs not found' });
        }
        res.json(log.logs);
    } catch (err) {
        console.error('Error fetching logs:', err);
        res.status(500).json({ message: 'Error fetching data' });
    }
});

app.post('/logs/:serverId', async (req, res) => {
    const { serverId } = req.params;
    const { logType, logChannelId, embedColor } = req.body;

    try {
        const log = await Log.findOne({ serverId });
        if (!log) {
            return res.status(404).json({ message: 'Server logs not found' });
        }

        const logEntry = log.logs.find(entry => entry.logType === logType);
        if (logEntry) {
            logEntry.logChannelId = logChannelId;
            logEntry.embedColor = embedColor;
        } else {
            log.logs.push({ logType, logChannelId, embedColor });
        }

        await log.save();
        res.json({ message: 'Log settings updated successfully' });
    } catch (err) {
        console.error('Error updating logs:', err);
        res.status(500).json({ message: 'Error saving data' });
    }
});

app.get('/:serverId/Logs', async (req, res) => {
    const serverId = req.params.serverId;
    if (!req.isAuthenticated()) {
        return res.redirect('/loading-auth');
    }

    const { username, id, avatar, guilds } = req.user || {};

    fs.readFile(__dirname + '/dashboard/pages/logs.html', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(500).send('Error reading file');
        }

        data = data.replace(/\${userId}/g, id || '');
        data = data.replace(/\${username}/g, username || '');
        data = data.replace(/\${avatar}/g, `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`);
        data = data.replace(/\${serverId}/g, serverId || 'ERR');

        res.send(data);
    });
});

app.get('/:serverId/auto_responderr', async (req, res) => {
    const serverId = req.params.serverId;
    try {
        const autoResponders = await AutoResponder.find({ guildId: serverId });
        res.json(autoResponders);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
});

app.post('/:serverId/auto_responder', async (req, res) => {
    const guildId = req.params.serverId;
    const { trigger, response, replyType, allowedRoles, disallowedRoles } = req.body;

    try {
        const autoResponder = new AutoResponder({ guildId, trigger, response, replyType, allowedRoles, disallowedRoles });
        await autoResponder.save();
        res.status(200).json({ trigger, response, replyType, allowedRoles, disallowedRoles, message: 'Auto-response added successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
});

app.delete('/:serverId/auto_responder/:trigger', async (req, res) => {
    const guildId = req.params.serverId;
    const trigger = req.params.trigger;

    try {
        await AutoResponder.deleteOne({ guildId, trigger });
        res.status(200).json({ message: 'Auto-response deleted successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
});

app.post('/:serverId/settings', (req, res) => {
    const serverId = req.params.serverId;
    const { prefix, otherSettings } = req.body;

    if (serverId) {
        db.set(`settings_${serverId}`, { prefix, otherSettings });
        res.redirect(`/${serverId}/settings`);
    } else {
        res.status(400).send('Invalid server ID!');
    }
});

app.post('/toggle-command', (req, res) => {
    const commandName = req.body.commandName;
    const newState = req.body.newState === 'true';
    res.send({ message: 'تم تحديث الحالة بنجاح!' });
});

async function fetchFromMultipleUrls(urls) {
    for (const url of urls) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return await response.buffer();
            }
        } catch (error) {
            console.error(`Error fetching from ${url}: ${error.message}`);
        }
    }
    throw new Error('All fetch attempts failed');
}

function formatMotd(motd) {
    if (typeof motd === 'string') {
        return motd.replace(/§([0-9a-fk-or])/g, '<span style="color: #$1;">').replace(/§r/g, '</span>');
    }
    if (motd && motd.extra) {
        return motd.extra.map(part => {
            const color = part.color ? `color: ${part.color};` : 'color: #000000;';
            return `<span style="${color}">${part.text}</span>`;
        }).join('');
    }
    return motd ? motd.text || motd : 'N/A';
}

function formatServerInfo(data, host, port) {
    const motd = data.description ? formatMotd(data.description) : 'N/A';
    return {
        server_name: data.description ? (data.description.text || data.description) : 'N/A',
        server_ip: `${host}:${port}`,
        favicon: `/api/icon/${host}:${port}`,
        player_count: data.players ? `${data.players.online}/${data.players.max}` : 'N/A',
        motd: motd,
        status: data.online ? 'online' : 'offline',
        players: {
            online: data.players ? data.players.online : 'N/A',
            max: data.players ? data.players.max : 'N/A',
            list: data.players ? (data.players.sample ? data.players.sample.map(player => player.name) : []) : []
        }
    };
}

client.commands = new Map();
client.mcommands = new Map();

app.get('/commands', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/loading-auth');
    }
    res.sendFile(path.join(__dirname, 'dashboard', 'pages', 'commands.html'));
});

app.get('/api/commands', async (req, res) => {
    const commands = await Command.find();
    res.json(commands);
});

app.post('/api/commands', async (req, res) => {
    const { name, settings, enabled } = req.body;
    const command = await Command.findOne({ name });

    if (command) {
        command.settings = settings;
        command.enabled = enabled;
        await command.save();
    } else {
        const newCommand = new Command(req.body);
        await newCommand.save();
    }

    res.status(200).send('Command settings saved successfully');
});

app.post('/api/prefix', async (req, res) => {
    const { prefix } = req.body;
    res.status(200).send('Prefix saved successfully');
});

app.get('/api/:type/:hostport', async (req, res) => {
    const { hostport, type } = req.params;
    const [host, port] = hostport.split(':');
    let urls;

    if (type === 'bedrock' || type === 'java') {
        urls = [
            `https://eu.mc-api.net/v3/server/ping/${host}:${port}`,
            `https://api.mcsrvstat.us/3/${host}:${port}`,
            `https://api.minetools.eu/ping/${host}/${port}`
        ];
    } else {
        res.status(400).send('<h1>Error: Invalid type specified</h1>');
        return;
    }

    try {
        const data = await fetchFromMultipleUrls(urls);
        const serverInfo = formatServerInfo(data, host, port);
        res.json(serverInfo);
    } catch (error) {
        console.error(`Error in /api/${type}/${hostport}: ${error.message}`);
        res.status(500).send('<h1>Error: Failed to fetch server status</h1>');
    }
});

app.get('/api/icon/:hostport', async (req, res) => {
    const { hostport } = req.params;
    const [host, port] = hostport.split(':');
    const urls = [
        `https://eu.mc-api.net/v3/server/favicon/${host}:${port}`,
        `https://api.mcsrvstat.us/icon/${host}:${port}`,
        `https://api.minetools.eu/favicon/${host}/${port}`
    ];

    try {
        const response = await fetchFromMultipleUrls(urls);
        res.setHeader('Content-Type', 'image/png');
        res.send(response);
    } catch (error) {
        console.error(`Error in /api/icon/${hostport}: ${error.message}`);
        res.status(500).send('<h1>Error: Failed to fetch server icon</h1>');
    }
});

app.get('/api/banner/:hostport', async (req, res) => {
    const { hostport } = req.params;
    const [host, port] = hostport.split(':');
    const urls = [
        `https://eu.mc-api.net/v3/server/ping/${host}:${port}`,
        `https://api.mcsrvstat.us/3/${host}:${port}`,
        `https://api.minetools.eu/ping/${host}/${port}`
    ];

    try {
        const data = await fetchFromMultipleUrls(urls);
        const serverInfo = formatServerInfo(data, host, port);
        const motdHtml = serverInfo.motd;
        const iconUrl = `/api/icon/${host}:${port}`;

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Server Banner</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #fff;
                        color: #000;
                        padding: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .card {
                        border: 1px solid #ccc;
                        padding: 20px;
                        border-radius: 10px;
                        box-shadow: 0 0 10px rgba(0,0,0,0.1);
                        text-align: center;
                        width: 400px;
                    }
                    .server-icon {
                        width: 64px;
                        height: 64px;
                        margin-bottom: 20px;
                    }
                    .server-name {
                        font-size: 24px;
                        margin-bottom: 10px;
                    }
                    .player-count {
                        margin-bottom: 20px;
                    }
                    .motd {
                        text-align: left;
                    }
                    .status {
                        margin-bottom: 10px;
                        font-weight: bold;
                        color: ${serverInfo.status === 'online' ? 'green' : 'red'};
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <img src="${iconUrl}" alt="Server Icon" class="server-icon" />
                    <div class="server-name">${serverInfo.server_name}</div>
                    <div class="status">Status: ${serverInfo.status}</div>
                    <div class="player-count">Players: ${serverInfo.player_count}</div>
                    <div class="motd">${motdHtml}</div>
                </div>
            </body>
            </html>
        `;

        res.send(htmlContent);
    } catch (error) {
        console.error(`Error in /api/banner/${hostport}: ${error.message}`);
        res.status(500).send('<h1>Error: Failed to fetch server banner</h1>');
    }
});

const BOT_REQUIRED_PERMISSION = 537250992;
const BOT_REQUIRED_PERMISSIONS = [
  0x00000020,
  0x00000010,
  0x00020000,
  0x00000080,
  0x00000400,
  0x00000800,
  0x00004000,
  0x00008000,
  0x00010000,
  0x00040000,
];

app.get('/servers', async (req, res) => {
  if (req.isAuthenticated()) {
    const MANAGE_GUILD_PERMISSION = 0x00000020;
    const userGuilds = req.user.guilds.filter(guild => guild.permissions & MANAGE_GUILD_PERMISSION);

    const blacklistedGuilds = await Blacklist.find({ isBlacklisted: true }).select('guildIds expiresAt isPermanent').lean();
    const blacklistedGuildIds = blacklistedGuilds.map(guild => guild.guildIds);

    const memberships = await Membership.find({ ismembership: true }).lean();
    const membershipGuildIds = memberships.map(m => m.Id);

    const processedGuilds = await Promise.all(userGuilds.map(async guild => {
      guild.bot_present = client.guilds.cache.has(guild.id);
      guild.isBlacklisted = blacklistedGuildIds.includes(guild.id);
      guild.hasMembership = membershipGuildIds.includes(guild.id);
      guild.hasPermission = (guild.permissions & MANAGE_GUILD_PERMISSION) === MANAGE_GUILD_PERMISSION;
      
      guild.iconUrl = guild.icon 
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` 
        : createDefaultIcon(guild.name);
      
      try {
        if (guild.icon) {
          const colors = await getColors(guild.iconUrl);
          guild.bannerColor = colors[0].hex();
        } else {
          guild.bannerColor = '#7289da';
        }
      } catch (err) {
        guild.bannerColor = '#7289da';
      }
      
      return guild;
    }));

    const validGuilds = processedGuilds.filter(guild => guild.hasPermission);
    
    const sortedGuilds = validGuilds.sort((a, b) => {
      const aHasBotPermission = (a.permissions & BOT_REQUIRED_PERMISSION) === BOT_REQUIRED_PERMISSION;
      const bHasBotPermission = (b.permissions & BOT_REQUIRED_PERMISSION) === BOT_REQUIRED_PERMISSION;

      if (a.bot_present && aHasBotPermission && (!b.bot_present || !bHasBotPermission)) {
        return -1;
      } else if (b.bot_present && bHasBotPermission && (!a.bot_present || !aHasBotPermission)) {
        return 1;
      } else if (a.isBlacklisted && !b.isBlacklisted) {
        return 1;
      } else {
        return new Date(b.joinedAt) - new Date(a.joinedAt);
      }
    });

    const featuredServers = sortedGuilds
      .filter(g => g.hasMembership && !g.isBlacklisted)
      .slice(0, 4);
    
const featuredHTML = featuredServers.map(guild => `
      <div class="card-bumpbed">
        <img src="${guild.iconUrl}" alt="${guild.name}">
        <div class="card-bumpbed-content">
          <h4>${guild.name}</h4>
          <a href="/${guild.id}/preview" class="btn-preview">Preview Server</a>
        </div>
      </div>
    `).join('');
    
    const allServersHTML = sortedGuilds.map(guild => {
        let buttonHtml;
        if (guild.isBlacklisted) {
            buttonHtml = `<a href="#" class="btn-dashboard">View Details</a>`;
        } else if (guild.bot_present) {
            buttonHtml = `<a href="/${guild.id}/overview" class="btn-dashboard">Manage Server</a>`;
        } else {
            buttonHtml = `<a href="/invite?guild_id=${guild.id}" class="btn-dashboard">Invite</a>`;
        }
        return `
        <div class="card ${guild.hasMembership ? 'premium' : ''} ${guild.isBlacklisted ? 'blacklist' : ''}">
          <div class="card-banner" style="background-color: ${guild.bannerColor};"></div>
          <img src="${guild.iconUrl}" alt="${guild.name}">
          ${guild.hasMembership ? '<div class="membership-badge">Premium</div>' : ''}
          ${guild.isBlacklisted ? '<div class="blacklist-badge">Blacklisted</div>' : ''}
          <div class="card-content">
            <h4>${guild.name}</h4>
            ${buttonHtml}
          </div>
        </div>
      `;
    }).join('');

    const template = fs.readFileSync(__dirname + '/dashboard/pages/servers.html', 'utf8');
    const finalHTML = template
        .replace('<!-- FEATURED_SERVERS_PLACEHOLDER -->', featuredHTML)
      .replace('<!-- ALL_SERVERS_PLACEHOLDER -->', allServersHTML);

    res.send(finalHTML);
  } else {
    res.redirect('/loading-auth');
  }
});

function createDefaultIcon(guildName) {
  const initials = guildName.replace(/\W+(.)/g, (match, chr) => chr.toUpperCase()).substring(0, 2);
  return `https://plchldr.co/i/128x128?&bg=7289da&fc=ffffff&text=${initials}`;
}

app.get('/invite', (req, res) => {
  const guildId = req.query.guild_id;
  if (guildId) {
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot&guild_id=${guildId}&response_type=code&redirect_uri=https://promcbot.qzz.io/servers`;
    res.redirect(inviteUrl);
  } else {
    res.status(400).send('Guild ID is required');
  }
});

app.get('/invitebot', (req, res) => {
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot&response_type=code&redirect_uri=https://promcbot.qzz.io/servers`;
    res.redirect(inviteUrl);
});

const owner = '1Dmar';
const repo = 'PelicanDocs';
const docsPath = 'docs';
const converter = new showdown.Converter();
converter.setOption('tables', true);
converter.setOption('tasklists', true);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/docs', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/loading-auth');
    }
    res.sendFile(path.join(__dirname, 'dashboard', 'pages', 'docs', 'docs.html'));
});

app.get('/api/docs', async (req, res) => {
  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${docsPath}`);
    const files = response.data;

    const categories = { 0: [], final: [] };

    files.forEach(file => {
      if (file.type === 'dir') {
        const categoryName = file.name;
        if (categoryName.startsWith('ONE-')) {
          categories[0].push({ name: categoryName, path: file.path, order: 0 });
        } else if (categoryName.startsWith('final-')) {
          categories.final.push({ name: categoryName, path: file.path });
        } else {
          const [name, order] = categoryName.split('-');
          if (!categories[name]) {
            categories[name] = [];
          }
          categories[name].push({ name: categoryName, path: file.path, order: parseInt(order) });
        }
      }
    });

    for (const category in categories) {
      if (category !== '0' && category !== 'final') {
        categories[category].sort((a, b) => a.order - b.order);
      }
    }

    res.json(categories);
  } catch (error) {
    console.error('Error fetching docs:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/docs/:file', async (req, res) => {
  const filePath = `${docsPath}/${req.params.file}`;
  try {
    const response = await axios.get(`https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`);
    const content = response.data;
    const htmlContent = converter.makeHtml(content);
    res.json({ htmlContent });
  } catch (error) {
    console.error('Error fetching doc file:', error);
    res.status(404).send('File not found');
  }
});

const PTERO_PANEL_URL = process.env.PTERO_PANEL_URL || "http://79.99.40.71"; 
const PTERO_API_KEY   = process.env.PTERO_API_KEY || "ptlc_l7c1ldnrll98XoYxXrgvvj0tRO3wWoRrS9mLNP7dsDZ";
const servers = [
  { name: "ProMcBot", serverId: "e99945bf" },
  { name: "Dashboard", serverId: "3e5d7f54" },
  { name: "API Server", serverId: "e99945bf" }
];

async function getServerStatus(server) {
  try {
    const response = await axios.get(`${PTERO_PANEL_URL}/api/client/servers/${server.serverId}/resources`, {
      headers: {
        'Authorization': `Bearer ${PTERO_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    const currentState = response?.data?.attributes?.current_state;
    let status;
    if (currentState === 'running') {
      status = 'running';
    } else if (currentState === 'starting') {
      status = 'starting';
    } else {
      status = 'closed';
    }

    return {
      name: server.name,
      status: status,
      lastUpdated: new Date().toLocaleString()
    };
  } catch (error) {
    console.error(`Error fetching status for ${server.name}:`, error.message);
    return {
      name: server.name,
      status: "closed",
      lastUpdated: new Date().toLocaleString()
    };
  }
}

app.get('/api/status', async (req, res) => {
  try {
    const statusPromises = servers.map(server => getServerStatus(server));
    const statusData = await Promise.all(statusPromises);
    res.json(statusData);
  } catch (error) {
    console.error("Error fetching server statuses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/status', (req, res) => {
  /*  if (!req.isAuthenticated()) {
        return res.redirect('/loading-auth');
    }*/
    res.sendFile(path.join(__dirname, '/dashboard/pages/ServerStatus.html'));
});

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

app.get('/api/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

app.get('/callback/check/userData', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        username: req.user.username,
        avatar: `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png?size=128`
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

let serverData = { server1: {}, server2: {}, server3: {} };

app.get('/', async (req, res) => {
    let totalChannels = 0;
    let totalUsers = 0;
    client.guilds.cache.forEach(guild => {
      totalChannels += guild.channels.cache.size;
      totalUsers += guild.memberCount;
    });

    const totalGuilds = client.guilds.cache.size;
    
    function formatNumber(num) {
        return num.toLocaleString();
    }
    
    const guildsArray = client.guilds.cache.map(guild => guild);
    const sortedGuilds = guildsArray.sort((a, b) => b.memberCount - a.memberCount);
    const top3Guilds = sortedGuilds.slice(0, 3);

    serverData = {
      server1: top3Guilds[0] ? { name: top3Guilds[0].name, memberCount: top3Guilds[0].memberCount } : {},
      server2: top3Guilds[1] ? { name: top3Guilds[1].name, memberCount: top3Guilds[1].memberCount } : {},
      server3: top3Guilds[2] ? { name: top3Guilds[2].name, memberCount: top3Guilds[2].memberCount } : {},
    };
    
  fs.readFile(__dirname + '/dashboard/home.html', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return res.status(500).send('Error reading file');
    }

    data = data.replace(/\${users}/g, formatNumber(totalUsers) || '');
    data = data.replace(/\${channels}/g, formatNumber(totalChannels) || '');
    data = data.replace(/\${guilds}/g, formatNumber(totalGuilds) || '');
    data = data.replace(/\${cpu}/g, cpuUsagePercent | 'ERR');
    data = data.replace(/\${server1.name}/g, serverData.server1?.name || '');
    data = data.replace(/\${server1.memberCount}/g, formatNumber(serverData.server1?.memberCount) || '');
    data = data.replace(/\${server2.name}/g, serverData.server2?.name || '');
    data = data.replace(/\${server2.memberCount}/g, formatNumber(serverData.server2?.memberCount) || '');
    data = data.replace(/\${server3.name}/g, serverData.server3?.name || '');
    data = data.replace(/\${server3.memberCount}/g, formatNumber(serverData.server3?.memberCount) || '');
    res.send(data);
  });
});

app.get('/:serverId/status', async (req, res) => {
    const serverId = req.params.serverId;
    if (req.isAuthenticated()) {
        const ssServer = await ServerInfo.findOne({ serverId });
        const {
            serverName = "No server name set",
            javaIP = "No javaip set",
            javaPort = "No javaport set",
            bedrockIP = "No bedrockip set",
            bedrockPort = "No bedrockport set"
        } = ssServer || {};

        fs.readFile(__dirname + '/dashboard/pages/server-status.html', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading file:', err);
                return res.status(500).send('Error reading file');
            }
            data = data.replace(/\${serverName}/g, serverName || '');
            data = data.replace(/\${javaIP}/g, javaIP || '');
            data = data.replace(/\${javaPort}/g, javaPort || '');
            data = data.replace(/\${bedrockIP}/g, bedrockIP || '');
            data = data.replace(/\${bedrockPort}/g, bedrockPort || '');
            data = data.replace(/\${serverId}/g, serverId || '');
            res.send(data);
        });
    } else {
        res.redirect('/loading-auth');
    }
});

app.get("/tickets/:ticketId/messages", (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/loading-auth');
    }
    res.sendFile(path.join(__dirname, 'dashboard', 'pages', 'ticket.html'));
});

client1.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (message.channel.type === ChannelType.DM) {
        const userId = message.author.id;
        const guild = await client1.guilds.fetch(DISCORD_GUILD_ID.toString()).catch(() => null);
        if (!guild) {
            console.error("🔴 Bot is not in the specified guild");
            return;
        }

        let ticketDoc = await findOpenTicketByUser(userId);
        let channel;
        const ticketId = nanoid(8);
        const user1 = await client1.users.fetch(userId).catch(() => null);

        if (!ticketDoc) {
            await message.react('1378995321601785887');
            await user1.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#0099ff")
                        .setTitle("ProMcBot Support – ModMail")
                        .setDescription(`Thank you for creating a new mail, a staff member should respond to your ticket anytime soon! (${ticketId})`)
                        .setTimestamp(),
                ],
            });
            
            channel = await guild.channels.create({
                name: `modmail-${ticketId}`,
                type: ChannelType.GuildText,
                parent: MODMAIL_CATEGORY_ID,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: message.author.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                    },
                ],
            });

            const newTicket = new Ticket({
                ticketId,
                userId,
                channelId: channel.id,
                status: "open",
                createdAt: new Date(),
            });
            await newTicket.save();
            ticketDoc = newTicket.toObject();

            await channel.send({
                embeds: [
                    {
                        title: "🆕 New ModMail Ticket",
                        description: `User <@${userId}> opened a ticket.`,
                        color: 0xffcc00,
                        timestamp: new Date(),
                        footer: { text: `Ticket ID: ${ticketId}` },
                    },
                ],
            });
        } else {
            channel = await guild.channels.fetch(ticketDoc.channelId).catch(() => null);
            if (!channel) {
                console.error("🔴 Failed to fetch existing ticket channel; it may have been deleted.");
                return;
            }
        }
        
        await message.react('1378995321601785887');
        const dmEmbed = {
            author: {
                name: `>> ${message.author.tag} [Member]`,
                icon_url: message.author.displayAvatarURL({ dynamic: true }),
            },
            thumbnail: {
                url: message.author.displayAvatarURL({ dynamic: true }),
            },
            description: message.content,
            color: 0x0099ff,
            footer: { text: `User ID: ${userId}` },
            timestamp: new Date(),
        };
        await channel.send({ embeds: [dmEmbed] });

        await new Message({
            ticket: ticketDoc.ticketId,
            authorId: userId,
            content: message.content,
            timestamp: new Date(),
            direction: "user",
        }).save();
    }
});

client1.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild || message.guild.id !== DISCORD_GUILD_ID.toString()) return;
    if (message.channel.parentId !== MODMAIL_CATEGORY_ID.toString()) return;

    const ticketDoc = await findOpenTicketByChannel(message.channel.id);
    if (!ticketDoc) return;

    const { ticketId, userId } = ticketDoc;

    if (message.content.trim().toLowerCase() === "!close") {
        await Ticket.findOneAndUpdate(
            { ticketId, status: "open" },
            { status: "closed", closedAt: new Date() }
        );

        const user = await client1.users.fetch(userId).catch(() => null);
        if (user) {
            const closeEmbed = new EmbedBuilder()
                .setColor("#ff5555")
                .setTitle(`Your mail has been closed. (${ticketId})`)
                .setDescription(`**${message.author.username}** has closed your mail since it's marked as completed. Thank you for using our support!`)
                .setFooter({ text: `Ticket ID: ${ticketId}` })
                .setTimestamp();
            await user.send({ embeds: [closeEmbed] }).catch(() => {
                console.warn(`Could not DM user ${userId} after closing ticket.`);
            });
        }

        await message.channel.send({
            embeds: [{
                description: "✅ Ticket has been closed. This channel will be moved to new category in 5 seconds.",
                color: 0x00cc66,
                timestamp: new Date(),
            }],
        });

        setTimeout(async() => {
            await message.channel.setParent(newCategoryId.toString(), { lockPermissions: false })
                .then(updatedChannel => {
                    return updatedChannel.permissionOverwrites.set([
                        {
                            id: message.author.id,
                            deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                        },
                        {
                            id: guild.roles.everyone,
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        },
                    ]);
                });
            await message.channel.send({
                embeds: [{
                    description: `✅ Ticket has been moved to Ticket Log.\nTo see ticket messages: http://promcbot.qzz.io/tickets/${ticketId}/messages`,
                    color: 0x00cc66,
                    timestamp: new Date(),
                }],
            });
        }, 5000);
        return;
    }

    const user = await client1.users.fetch(userId).catch(() => null);
    if (user) {
        await message.react('1378995321601785887');
        const staffEmbed = {
            author: {
                name: `>> ${message.author.tag} [Moderator]`,
                icon_url: message.author.displayAvatarURL({ dynamic: true }),
            },
            thumbnail: {
                url: message.author.displayAvatarURL({ dynamic: true }),
            },
            description: message.content,
            color: 0x43b581,
            footer: { text: `From #${message.channel.name}` },
            timestamp: new Date(),
        };
        await user.send({ embeds: [staffEmbed] }).catch(() => {
            console.warn(`Failed to send DM to user ${userId}`);
        });
    }
    
    await new Message({
        ticket: ticketId,
        authorId: message.author.id,
        content: message.content,
        timestamp: new Date(),
        direction: "mod",
    }).save();
});

app.get('/:serverId/overview', async (req, res) => {
    const serverId = req.params.serverId;
    // حساب الوقت قبل 24 ساعة من الآن
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    let activeCount = 0;

    // الحصول على جميع قنوات السيرفر من الكاش
    const channels = message.guild.channels.cache;

    // المرور على كل قناة للتحقق من نشاطها
    channels.forEach(channel => {
        // التحقق من أنها قناة كتابية (وليست صوتية أو تصنيف) وأن بها رسالة أخيرة
        if (channel.isTextBased() && channel.lastMessageId) {
            
            // استخراج وقت إرسال آخر رسالة من الـ ID الخاص بها
            const lastMessageTimestamp = BigInt(channel.lastMessageId) >> 22n;
            const messageDate = new Date(Number(lastMessageTimestamp) + 1420070400000);

            // المقارنة مع الوقت قبل 24 ساعة
            if (messageDate.getTime() > twentyFourHoursAgo) {
                activeCount++;
            }
        }
    });

    const guild = await client.guilds.fetch(serverId);
        if (!guild) {
            return res.status(404).json({ error: "Guild not found." });

        }
    const { id: userId, username, avatar, global_name } = req.user || {};
    
    if (req.isAuthenticated()) {
        const ssServer = await ServerInfo.findOne({ serverId });
        const {
            serverName = "Please do /setup_server command or go to https://promcbot.qzz.io/${serverId}/settings",
            javaIP = "No javaip set",
            javaPort = "No javaport set",
            bedrockIP = "No bedrockip set",
            bedrockPort = "No bedrockport set"
        } = ssServer || {};

        fs.readFile(__dirname + '/dashboard/pages/overview.html', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading file:', err);
                return res.status(500).send('Error reading file');
            }
            data = data.replace(/\${serverName}/g, serverName || '');
            data = data.replace(/\${memberCount}/g, guild.memberCount || '');
            data = data.replace(/\${activeCount}/g, activeCount || '');
            data = data.replace(/\${userId}/g, userId || '');
            data = data.replace(/\${avatar}/g, avatar || '');
            data = data.replace(/\${global_name}/g, global_name || '');
            data = data.replace(/\${username}/g, username || '');
            data = data.replace(/\${javaIP}/g, javaIP || '');
            data = data.replace(/\${javaPort}/g, javaPort || '');
            data = data.replace(/\${bedrockIP}/g, bedrockIP || '');
            data = data.replace(/\${bedrockPort}/g, bedrockPort || '');
            data = data.replace(/\${serverId}/g, serverId || '');
            res.send(data);
        });
    } else {
        res.redirect('/loading-auth');
    }
});


app.get("/overview/discord/:guildId", async (req, res) => {
    const guildId = req.params.guildId;
    if (!client.isReady()) {
        return res.status(503).json({ error: "Discord client not ready yet." });
    }

    try {
        const guild = await client.guilds.fetch(guildId);
        if (!guild) {
            return res.status(404).json({ error: "Guild not found." });
        }

        await guild.members.fetch();
        const channels = await guild.channels.fetch();
        let categoryCount = 0,
            textChannelCount = 0,
            voiceChannelCount = 0;

        channels.forEach((chan) => {
            if (chan.type === ChannelType.GuildCategory) categoryCount++;
            if (chan.type === ChannelType.GuildText) textChannelCount++;
            if (chan.type === ChannelType.GuildVoice) voiceChannelCount++;
        });

        const response = {
            guildId: guild.id,
            name: guild.name,
            memberCount: guild.memberCount || 0,
            categoryCount,
            textChannelCount,
            voiceChannelCount,
            roleCount: guild.roles.cache.size || 0,
        };

        return res.json(response);
    } catch (err) {
        console.error("❌ Error fetching Discord guild info:", err);
        if (err.code === 50001 || err.code === 50013) {
            return res.status(403).json({ error: "Missing access/permissions to fetch guild." });
        }
        return res.status(500).json({ error: "Internal server error." });
    }
});



        


        
app.get("/overview/minecraft/:serverId", async (req, res) => {
    const serverId = req.params.serverId;
    try {
        const serverDoc = await ServerInfo.findOne({ serverId }).lean();
        if (!serverDoc) {
            return res.status(404).json({ error: "MC server not set up." });
        }

        let liveHost, livePort;
        const typeLC = (serverDoc.serverType || "").toLowerCase();
        const isBedrockOnly = typeLC === "bedrock";
        if (isBedrockOnly) {
            if (!serverDoc.bedrockIP || !serverDoc.bedrockPort) {
                return res.status(404).json({ error: "Bedrock IP/Port missing in DB." });
            }
            liveHost = serverDoc.bedrockIP;
            livePort = serverDoc.bedrockPort;
        } else {
            if (!serverDoc.javaIP || !serverDoc.javaPort) {
                return res.status(404).json({ error: "Java IP/Port missing in DB." });
            }
            liveHost = serverDoc.javaIP;
            livePort = serverDoc.javaPort;
        }

        const urpURL = `https://api.mcsrvstat.us/3/${encodeURIComponent(liveHost)}:${encodeURIComponent(livePort)}`;

        let urpData = null;
        try {
            const urpResponse = await axios.get(urpURL, { timeout: 5000 });
            urpData = urpResponse.data;
        } catch (err) {
            console.warn("⚠️ Warning: Could not reach URP API or parse JSON:", err.message);
            urpData = { online: false };
        }

        const liveOnline = Boolean(urpData.online);
        const livePlayers = urpData.players?.online ?? 0;
        const maxPlayers = urpData.players?.max ?? 0;
        const version = urpData.version || null;
        const motd = urpData.motd?.clean || null;

        const merged = {
            serverId: serverDoc.serverId,
            serverName: serverDoc.serverName || serverDoc.serverId,
            serverType: serverDoc.serverType || "Unknown",
            javaIP: serverDoc.javaIP || null,
            javaPort: serverDoc.javaPort || null,
            bedrockIP: serverDoc.bedrockIP || null,
            bedrockPort: serverDoc.bedrockPort || null,
            online: liveOnline,
            livePlayers,
            maxPlayers,
            version,
            motd,
        };

        return res.json(merged);
    } catch (err) {
        console.error("❌ Error in /overview/minecraft/:serverId route:", err);
        return res.status(500).json({ error: "Internal server error." });
    }
});

app.get('/privacy-policy', (req, res) => {
    res.sendFile(path.join(__dirname, '/dashboard/pages/PrivacyPolicy.html'));
});

app.get('/loading-auth', (req, res) => {
    res.sendFile(path.join(__dirname, '/dashboard/Loading/loading.html'));
});

app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'dashboard')));
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'dashboard', '404', '404.html'));
});

//client.login(process.env.BOT_TOKEN);
//client1.login(process.env.MAIL_TOKEN);

//const PORT = process.env.PORT || 3000;
/*server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});*/
// أضف في نهاية الملف
module.exports.app = app; // إذا كان لديك متغير app
module.exports.client = client; // البوت الأول
module.exports.client1 = client1; // البوت الثاني