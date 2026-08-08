// dash/index.js - Fixed version
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
const app = express();
const cors = require("cors");
app.use(cors());
const Blacklist = require('../bot/Models/BlackList'); 
const Ticket = require('../bot/Models/Ticket'); 
const BotConfig = require('../bot/Models/BotConfig'); 
const Message = require('../bot/Models/Message'); 
const User = require('../bot/Models/apiKey'); 
const ServerStatus = require('../bot/Models/ServerStatus'); 
const Membership = require('../bot/Models/User'); 
const AutoResponder = require('../bot/Models/AutoResponder'); 
const Mentions = require('../bot/Models/Mentions');
const Language = require('../bot/Models/Langs');
const ApiKey = require('../bot/Models/Api'); 
const BumpedServer = require('../bot/Models/bumpedServer');
const ServerInfo = require('../bot/Models/Server');
const Log = require('../bot/Models/Log');
const path = require('path');
const http = require('http');
const Vibrant = require('node-vibrant');
const axios = require('axios');
const showdown = require('showdown');
const fs = require ('fs');
const { addFeature, removeFeature, fetchFeatures } = require('../bot/Models/featuresService'); 
const Feature = require('../bot/Models/Feature'); 
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
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember, Partials.Reaction]
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
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember, Partials.Reaction]
});

const DISCORD_CLIENT_ID= BigInt(1130577557461401622).toString();
const DISCORD_GUILD_ID=BigInt(1226151054178127872).toString();

app.use(bodyParser.urlencoded({ extended: true }));
mongoose.set("strictQuery", true);

// Using shared Database Manager
const { initDB } = require("../bot/utils/dbManager");
// We don't call initDB here if it's already called in server.js or bot/index.js
// But to be safe in standalone mode:
if (!mongoose.connection.readyState) {
  initDB().catch(err => console.error("Dashboard DB Init Error:", err));
}

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
app.use(express.json());

passport.use(
    new DiscordStrategy(
        {
            clientID: "1220005260857311294",
            clientSecret: "KWAY2Bw_eJ4ZVHWDwgoJ3ZRVPAqv9o7G",
            callbackURL: process.env.CALLBACK_URL || "https://promcbot.qzz.io/auth/discord/callback",
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
  (req, res) => res.redirect('/dashboard')
);

const DASHBOARD_ROOT = path.join(__dirname, 'dashboard');
const DASHBOARD_PAGES_ROOT = path.join(DASHBOARD_ROOT, 'pages');
const DASHBOARD_DOCS_ROOT = path.join(DASHBOARD_PAGES_ROOT, 'docs');

const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

const MAIN_PAGE_ROUTES = {
  '/': path.join(DASHBOARD_ROOT, 'home.html'),
  '/home': path.join(DASHBOARD_ROOT, 'home.html'),
  '/dashboard': path.join(DASHBOARD_ROOT, 'dashboard.html'),
  '/servers': path.join(DASHBOARD_PAGES_ROOT, 'servers.html'),
  '/settings': path.join(DASHBOARD_PAGES_ROOT, 'settings.html'),
  '/users': path.join(DASHBOARD_PAGES_ROOT, 'users.html'),
  '/roles': path.join(DASHBOARD_PAGES_ROOT, 'roles.html'),
  '/logs': path.join(DASHBOARD_PAGES_ROOT, 'logs.html'),
  '/overview': path.join(DASHBOARD_PAGES_ROOT, 'overview.html'),
  '/premium': path.join(DASHBOARD_PAGES_ROOT, 'premium.html'),
  '/invite': path.join(DASHBOARD_PAGES_ROOT, 'invite.html'),
  '/commands': path.join(DASHBOARD_PAGES_ROOT, 'commands.html'),
  '/ticket': path.join(DASHBOARD_PAGES_ROOT, 'ticket.html'),
  '/activity': path.join(DASHBOARD_PAGES_ROOT, 'activity.html'),
  '/configuration': path.join(DASHBOARD_PAGES_ROOT, 'configuration.html'),
  '/moderation': path.join(DASHBOARD_PAGES_ROOT, 'moderation.html'),
  '/auto_responder': path.join(DASHBOARD_PAGES_ROOT, 'auto_responder.html'),
  '/sendembed': path.join(DASHBOARD_PAGES_ROOT, 'sendembed.html'),
  '/bugs': path.join(DASHBOARD_PAGES_ROOT, 'bugs.html'),
  '/server-status': path.join(DASHBOARD_PAGES_ROOT, 'server-status.html'),
  '/ServerStatus': path.join(DASHBOARD_PAGES_ROOT, 'ServerStatus.html'),
  '/PrivacyPolicy': path.join(DASHBOARD_PAGES_ROOT, 'PrivacyPolicy.html')
};

const SERVER_PAGE_ROUTES = {
  overview: path.join(DASHBOARD_PAGES_ROOT, 'overview.html'),
  premium: path.join(DASHBOARD_PAGES_ROOT, 'premium.html'),
  settings: path.join(DASHBOARD_PAGES_ROOT, 'settings.html'),
  moderation: path.join(DASHBOARD_PAGES_ROOT, 'moderation.html'),
  invite: path.join(DASHBOARD_PAGES_ROOT, 'invite.html'),
  logs: path.join(DASHBOARD_PAGES_ROOT, 'logs.html'),
  roles: path.join(DASHBOARD_PAGES_ROOT, 'roles.html'),
  auto_responder: path.join(DASHBOARD_PAGES_ROOT, 'auto_responder.html'),
  auro_responder: path.join(DASHBOARD_PAGES_ROOT, 'auto_responder.html'),
  activity: path.join(DASHBOARD_PAGES_ROOT, 'activity.html'),
  embeds: path.join(DASHBOARD_PAGES_ROOT, 'sendembed.html')
};

const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const getUserData = (req) => {
  const user = req.user || {};
  const userId = user.id || 'guest';
  const avatar = user.id && user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
    : DEFAULT_AVATAR;

  return {
    user,
    userId,
    username: user.username || 'Guest',
    global_name: user.global_name || user.username || 'Guest User',
    email: user.email || 'Not connected',
    avatar,
    login: req.isAuthenticated() ? 'Logout' : 'Login'
  };
};

const renderDashboardTemplate = (filePath, req, extraData = {}) => {
  let html = fs.readFileSync(filePath, 'utf8');
  const userData = getUserData(req);
  const replacements = {
    username: userData.username,
    global_name: userData.global_name,
    email: userData.email,
    avatar: userData.avatar,
    userId: userData.userId,
    login: userData.login,
    serverId: extraData.serverId || '',
    guildId: extraData.serverId || '',
    path: req.path
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(`\${${key}}`, escapeHtml(value));
  }

  return html;
};

const sendDashboardPage = (res, filePath, req, extraData = {}) => {
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Page not found');
  }

  const html = renderDashboardTemplate(filePath, req, extraData);
  res.type('html').send(html);
};

const ensureAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/discord');
  }
  next();
};

app.use('/docs', express.static(DASHBOARD_DOCS_ROOT));
app.use(express.static(DASHBOARD_ROOT));

app.get('/loading-auth', (req, res) => {
  const loadingPage = path.join(DASHBOARD_ROOT, 'Loading', 'loading.html');
  if (fs.existsSync(loadingPage)) {
    return res.sendFile(loadingPage);
  }
  return res.redirect('/auth/discord');
});

app.get('/callback/check/userData', (req, res) => {
  const userData = getUserData(req);
  res.json({
    authenticated: req.isAuthenticated(),
    user: req.isAuthenticated()
      ? {
          id: userData.userId,
          username: userData.username,
          global_name: userData.global_name,
          avatar: userData.avatar,
          email: userData.email
        }
      : null
  });
});

app.get('/api/logout', (req, res) => {
  req.logout(() => {
    req.session?.destroy(() => res.redirect('/'));
  });
});
app.get('/logout', (req, res) => {
  req.logout(() => {
    req.session?.destroy(() => res.redirect('/'));
  });
});

app.get('/api/status', async (req, res) => {
  try {
    const statuses = await ServerStatus.find().lean().limit(10);
    if (statuses.length) {
      return res.json(statuses.map((entry) => ({
        name: entry.name,
        status: entry.status || 'running'
      })));
    }
  } catch (error) {
    console.error('Failed to load server status:', error.message);
  }

  return res.json([
    { name: 'ProMcBot', status: 'running' },
    { name: 'Dashboard Server', status: 'running' },
    { name: 'API Server', status: 'running' }
  ]);
});

app.get('/api/commands', async (req, res) => {
  try {
    const commands = await Command.find().lean().limit(500);
    return res.json(commands);
  } catch (error) {
    console.error('Failed to load commands:', error.message);
    return res.json([]);
  }
});

app.post('/api/commands', async (req, res) => {
  const payload = req.body || {};
  if (!payload.name || !payload.type) {
    return res.status(400).json({ error: 'name and type are required' });
  }

  try {
    await Command.findOneAndUpdate(
      { name: payload.name, type: payload.type },
      {
        $set: {
          description: payload.description || '',
          enabled: payload.enabled !== false,
          settings: payload.settings || {}
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to save command settings:', error.message);
    return res.status(500).json({ success: false });
  }
});

app.post('/api/prefix', (req, res) => {
  const prefix = typeof req.body?.prefix === 'string' ? req.body.prefix.trim() : '';
  return res.json({ success: true, prefix: prefix || '!' });
});

app.get('/bumped-servers', async (req, res) => {
  try {
    const bumpedServers = await BumpedServer.find().lean().limit(50);
    const payload = bumpedServers.map((server) => ({
      id: server.guildId,
      title: `Server ${server.guildId}`,
      name: `Server ${server.guildId}`,
      iconUrl: DEFAULT_AVATAR,
      url: DEFAULT_AVATAR
    }));
    return res.json(payload);
  } catch (error) {
    console.error('Failed to load bumped servers:', error.message);
    return res.json([]);
  }
});

app.get('/invitebot', (req, res) => {
  res.redirect('https://discord.com/api/oauth2/authorize?client_id=1220005260857311294&permissions=8&scope=bot%20applications.commands');
});

app.get('/account', ensureAuthenticated, (req, res) => {
  sendDashboardPage(res, MAIN_PAGE_ROUTES['/dashboard'], req);
});

Object.entries(MAIN_PAGE_ROUTES).forEach(([routePath, filePath]) => {
  const protectedRoute = routePath !== '/' && routePath !== '/home' && routePath !== '/loading-auth';
  app.get(routePath, protectedRoute ? ensureAuthenticated : (req, res, next) => next(), (req, res) => {
    sendDashboardPage(res, filePath, req);
  });
});

app.get('/:serverId/:section', ensureAuthenticated, (req, res, next) => {
  const pagePath = SERVER_PAGE_ROUTES[req.params.section];
  if (!pagePath) {
    return next();
  }

  return sendDashboardPage(res, pagePath, req, { serverId: req.params.serverId });
});

app.use((req, res) => {
  const notFoundPage = path.join(DASHBOARD_ROOT, '404', '404.html');
  if (fs.existsSync(notFoundPage)) {
    return res.status(404).sendFile(notFoundPage);
  }
  return res.status(404).send('Not Found');
});

module.exports.app = app;
module.exports.client = client;
module.exports.client1 = client1;
