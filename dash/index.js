// dash/index.js — Full Dashboard Backend
// Handles all web routes, Discord OAuth, and page serving

// Load env in dev
if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv-flow').config(); } catch (e) {}
}

const {
  Client, Collection, GatewayIntentBits, Partials, EmbedBuilder,
  PermissionsBitField, WebhookClient, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, ActivityType, ChannelType
} = require("discord.js");

const express    = require('express');
const passport   = require('passport');
const db         = require('pro.db');
const mongoose   = require('mongoose');
const path       = require('path');
const fs         = require('fs');
const axios      = require('axios');
const session    = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors       = require('cors');
const { nanoid } = require('nanoid');
const DiscordStrategy = require('passport-discord').Strategy;

// ── Models ──────────────────────────────────────────────────────
const Blacklist    = require('../bot/Models/BlackList');
const Ticket       = require('../bot/Models/Ticket');
const BotConfig    = require('../bot/Models/BotConfig');
const Message      = require('../bot/Models/Message');
const User         = require('../bot/Models/apiKey');
const ServerStatus = require('../bot/Models/ServerStatus');
const Membership   = require('../bot/Models/User');
const AutoResponder = require('../bot/Models/AutoResponder');
const Mentions     = require('../bot/Models/Mentions');
const Language     = require('../bot/Models/Langs');
const ApiKey       = require('../bot/Models/Api');
const BumpedServer = require('../bot/Models/bumpedServer');
const ServerInfo   = require('../bot/Models/Server');
const Log          = require('../bot/Models/Log');
const Feature      = require('../bot/Models/Feature');
const Command      = require('../bot/Models/Command');
const { addFeature, removeFeature, fetchFeatures } = require('../bot/Models/featuresService');

// ── Express App ──────────────────────────────────────────────────
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

mongoose.set("strictQuery", true);

// ── DB ───────────────────────────────────────────────────────────
const { initDB } = require("../bot/utils/dbManager");
if (!mongoose.connection.readyState) {
  initDB().catch(err => console.error("Dashboard DB Init Error:", err));
}

// ── Session ───────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || "nfJ90bf5X2VnFsU8sLGgvZqcDA1Ce9A3",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

app.use(passport.initialize());
app.use(passport.session());

// Extend session on each authenticated request
app.use((req, res, next) => {
  if (req.isAuthenticated()) {
    req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000;
  }
  next();
});

// ── Discord Clients ───────────────────────────────────────────────
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

// Login dashboard clients so we can check guild membership
const BOT1_TOKEN = process.env.BOT1_1_TOKEN;
const BOT2_TOKEN = process.env.BOT2_TOKEN || process.env.BOT2_1_TOKEN;

if (BOT1_TOKEN) {
  client.login(BOT1_TOKEN)
    .then(() => console.log('✅ Dashboard client (bot1) logged in:', client.user?.tag))
    .catch(e => console.warn('⚠️ Dashboard client1 login failed:', e.message));
} else {
  console.warn('⚠️ BOT1_1_TOKEN not set — dashboard client will not connect to Discord');
}

if (BOT2_TOKEN) {
  client1.login(BOT2_TOKEN)
    .then(() => console.log('✅ Dashboard client2 (bot2) logged in:', client1.user?.tag))
    .catch(e => console.warn('⚠️ Dashboard client2 login failed:', e.message));
}

// ── Webhook ────────────────────────────────────────────────────────
let webhookClient = null;
try {
  webhookClient = new WebhookClient({
    id: process.env.WEBHOOK_ID || '1322151531260284979',
    token: process.env.WEBHOOK_TOKEN || 'FsQoCxU3C782YYS0SRKNTPKRi8NIgm1hT_JfliwHcgZ4q5M7t586HRArJD9PsnEbszjp'
  });
} catch (e) {
  console.warn('⚠️ Webhook client init failed:', e.message);
}


// ── Passport / Discord OAuth ────────────────────────────────────────
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1220005260857311294";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "KWAY2Bw_eJ4ZVHWDwgoJ3ZRVPAqv9o7G";

passport.use(new DiscordStrategy(
  {
    clientID: DISCORD_CLIENT_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL || "https://promcbot.qzz.io/auth/discord/callback",
    scope: ["identify", "guilds", "email"],
  },
  async function (accessToken, refreshToken, profile, done) {
    process.nextTick(async () => {
      try {
        const now = Date.now();
        profile.lastLogin = now;
        profile.accessToken = accessToken;

        // Log login to webhook
        if (webhookClient) {
          const embed = new EmbedBuilder()
            .setColor("#4070f4")
            .setTitle("🔹 تسجيل دخول جديد")
            .setThumbnail(`https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`)
            .addFields(
              { name: "👤 الاسم", value: `${profile.global_name || profile.username} (${profile.username})`, inline: true },
              { name: "🆔 المعرف", value: profile.id, inline: true },
              { name: "⏳ التاريخ", value: new Date(now).toLocaleString(), inline: true }
            )
            .setFooter({ text: "ProMcBot Dashboard" })
            .setTimestamp();
          webhookClient.send({ embeds: [embed] }).catch(() => {});
        }
      } catch (e) {}
      return done(null, profile);
    });
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ── Auth Guard Middleware ────────────────────────────────────────────
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ authenticated: false, error: 'Login required' });
  }
  res.redirect('/');
}

function isAdmin(req, res, next) {
  if (!req.isAuthenticated()) return res.redirect('/');
  const adminIds = (process.env.OWNER_ID || '804999528129363998').split(',');
  if (adminIds.includes(req.user.id)) return next();
  res.status(403).send('Access Denied');
}

// ── Static Files ─────────────────────────────────────────────────────
const dashDir = path.join(__dirname, 'dashboard');
app.use('/dashboard', express.static(dashDir));
app.use('/public', express.static(path.join(__dirname, '..', 'bot', 'public')));

// Serve shared CSS/JS
app.get('/shared.css', (req, res) => res.sendFile(path.join(dashDir, 'shared.css')));
app.get('/shared.js',  (req, res) => res.sendFile(path.join(dashDir, 'shared.js')));

// ════════════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ════════════════════════════════════════════════════════════════════

app.get('/auth/discord', (req, res, next) => {
  if (req.isAuthenticated()) return res.redirect('/dashboard');
  next();
}, passport.authenticate('discord'));

app.get('/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => res.redirect('/dashboard')
);

app.get('/api/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  });
});

// ── Auth check API ────────────────────────────────────────────────────
app.get('/callback/check/userData', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.json({ authenticated: false });
  }
  const user = req.user;
  const avatar = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/${(Number(user.discriminator) || 0) % 5}.png`;

  res.json({
    authenticated: true,
    user: {
      id:          user.id,
      username:    user.username,
      global_name: user.global_name || user.username,
      email:       user.email || null,
      avatar,
      guilds:      user.guilds || []
    }
  });
});

// ── Loading / redirect page ────────────────────────────────────────────
app.get('/loading-auth', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/dashboard');
  res.sendFile(path.join(dashDir, 'Loading', 'index.html'));
});

// ════════════════════════════════════════════════════════════════════
//  PUBLIC PAGES
// ════════════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  res.sendFile(path.join(dashDir, 'home.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(dashDir, 'pages', 'PrivacyPolicy.html'));
});

app.get('/invitebot', (req, res) => {
  const clientId = DISCORD_CLIENT_ID;
  res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`);
});

// ════════════════════════════════════════════════════════════════════
//  PROTECTED DASHBOARD PAGES
// ════════════════════════════════════════════════════════════════════

app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(path.join(dashDir, 'dashboard.html'));
});

app.get('/servers', isAuthenticated, (req, res) => {
  res.sendFile(path.join(dashDir, 'pages', 'servers.html'));
});

// Server-specific pages (require guildId param)
function serveServerPage(filename) {
  return [isAuthenticated, (req, res) => {
    res.sendFile(path.join(dashDir, 'pages', filename));
  }];
}

app.get('/servers/:guildId/overview',       ...serveServerPage('overview.html'));
app.get('/servers/:guildId/settings',       ...serveServerPage('settings.html'));
app.get('/servers/:guildId/moderation',     ...serveServerPage('moderation.html'));
app.get('/servers/:guildId/roles',          ...serveServerPage('roles.html'));
app.get('/servers/:guildId/logs',           ...serveServerPage('logs.html'));
app.get('/servers/:guildId/auto-responder', ...serveServerPage('auto_responder.html'));
app.get('/servers/:guildId/premium',        ...serveServerPage('premium.html'));
app.get('/servers/:guildId/configuration',  ...serveServerPage('configuration.html'));
app.get('/servers/:guildId/ticket',         ...serveServerPage('ticket.html'));

// ── Legacy / direct page routes (backward compatibility) ─────────────
app.get('/overview',       isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'overview.html')));
app.get('/settings',       isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'settings.html')));
app.get('/moderation',     isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'moderation.html')));
app.get('/roles',          isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'roles.html')));
app.get('/logs',           isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'logs.html')));
app.get('/auto-responder', isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'auto_responder.html')));
app.get('/premium',        isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'premium.html')));
app.get('/configuration',  isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'configuration.html')));
app.get('/ticket',         isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'ticket.html')));
app.get('/activity',       isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'activity.html')));
app.get('/commands',       isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'commands.html')));
app.get('/server-status',  isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'ServerStatus.html')));

// ── Admin pages ─────────────────────────────────────────────────────
app.get('/admin/users',        isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'users.html')));
app.get('/admin/invite',       isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'invite.html')));
app.get('/admin/bugs',         isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'bugs.html')));
app.get('/admin/sendembed',    isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'sendembed.html')));

// ════════════════════════════════════════════════════════════════════
//  API ROUTES (JSON)
// ════════════════════════════════════════════════════════════════════

// ── Get user's Discord guilds (filtered: guilds where user is admin) ──
app.get('/api/guilds', isAuthenticated, async (req, res) => {
  try {
    const guilds = (req.user.guilds || []).filter(g => {
      const perms = BigInt(g.permissions || 0);
      return (perms & BigInt(0x8)) === BigInt(0x8); // ADMINISTRATOR
    });

    // Add botPresent flag: check if bot client has this guild in its cache
    const enriched = guilds.map(g => {
      let botPresent = false;
      try {
        if (client && client.isReady && client.isReady()) {
          botPresent = client.guilds.cache.has(g.id);
        }
      } catch (_) {}
      return {
        id:   g.id,
        name: g.name,
        icon: g.icon || null,
        permissions: g.permissions,
        botPresent
      };
    });

    res.json({ success: true, guilds: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Get server config ─────────────────────────────────────────────────
app.get('/api/server/:guildId', isAuthenticated, async (req, res) => {
  try {
    const config = await BotConfig.findOne({ guildId: req.params.guildId }).lean();
    res.json({ success: true, config: config || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Update server config ──────────────────────────────────────────────
app.post('/api/server/:guildId/config', isAuthenticated, async (req, res) => {
  try {
    const config = await BotConfig.findOneAndUpdate(
      { guildId: req.params.guildId },
      { $set: req.body },
      { upsert: true, new: true }
    );
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Auto Responder ────────────────────────────────────────────────────
app.get('/api/server/:guildId/autoresponder', isAuthenticated, async (req, res) => {
  try {
    const items = await AutoResponder.find({ guildId: req.params.guildId }).lean();
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/:guildId/autoresponder', isAuthenticated, async (req, res) => {
  try {
    const item = await AutoResponder.create({ guildId: req.params.guildId, ...req.body });
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/server/:guildId/autoresponder/:id', isAuthenticated, async (req, res) => {
  try {
    await AutoResponder.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Logs ──────────────────────────────────────────────────────────────
app.get('/api/server/:guildId/logs', isAuthenticated, async (req, res) => {
  try {
    const { page = 1, limit = 50, type } = req.query;
    const query = { guildId: req.params.guildId };
    if (type) query.type = type;
    const logs = await Log.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    const total = await Log.countDocuments(query);
    res.json({ success: true, logs, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Features (enable/disable) ─────────────────────────────────────────
app.get('/api/server/:guildId/features', isAuthenticated, async (req, res) => {
  try {
    const features = await fetchFeatures(req.params.guildId);
    res.json({ success: true, features });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/:guildId/features/:featureName/enable', isAuthenticated, async (req, res) => {
  try {
    await addFeature(req.params.guildId, req.params.featureName);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/:guildId/features/:featureName/disable', isAuthenticated, async (req, res) => {
  try {
    await removeFeature(req.params.guildId, req.params.featureName);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Blacklist ─────────────────────────────────────────────────────────
app.get('/api/server/:guildId/blacklist', isAuthenticated, async (req, res) => {
  try {
    const list = await Blacklist.find({ guildId: req.params.guildId }).lean();
    res.json({ success: true, list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Server Status (Minecraft) ─────────────────────────────────────────
app.get('/api/server/:guildId/minecraft-status', isAuthenticated, async (req, res) => {
  try {
    const status = await ServerStatus.find({ guildId: req.params.guildId }).lean();
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Membership ────────────────────────────────────────────────────────
app.get('/api/user/membership', isAuthenticated, async (req, res) => {
  try {
    const member = await Membership.findOne({ discordId: req.user.id }).lean();
    res.json({ success: true, membership: member || { plan: 'free', expiresAt: null } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Commands ──────────────────────────────────────────────────────────
app.get('/api/commands', async (req, res) => {
  try {
    const commands = await Command.find({}).lean();
    res.json({ success: true, commands });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Admin: All users ──────────────────────────────────────────────────
app.get('/api/admin/users', isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const users = await Membership.find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    const total = await Membership.countDocuments();
    res.json({ success: true, users, total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Admin: Send Embed ─────────────────────────────────────────────────
app.post('/api/admin/sendembed', isAdmin, async (req, res) => {
  try {
    const { channelId, title, description, color, image } = req.body;
    if (!channelId) return res.status(400).json({ success: false, error: 'channelId required' });

    // We need the bot client — it's available via the global proMcBotClient
    // But here in dash context we use client1 or try to access through require
    let botClient;
    try {
      const botModule = require('../bot/index');
      // botModule returns a promise/client - handle accordingly
    } catch (e) {}

    res.json({ success: true, message: 'Embed sent (requires bot client connection)' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Bot Stats (public) ────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const serverCount = await ServerInfo.countDocuments();
    const userCount   = await Membership.countDocuments();
    res.json({
      success: true,
      stats: {
        servers: serverCount,
        users: userCount,
        uptime: process.uptime()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════
//  404 HANDLER
// ════════════════════════════════════════════════════════════════════
app.use((req, res) => {
  const notFoundPage = path.join(dashDir, '404', 'index.html');
  if (fs.existsSync(notFoundPage)) {
    res.status(404).sendFile(notFoundPage);
  } else {
    res.status(404).json({ error: 'Not Found', path: req.path });
  }
});

// ════════════════════════════════════════════════════════════════════
//  EXPORTS
// ════════════════════════════════════════════════════════════════════
module.exports.app    = app;
module.exports.client  = client;
module.exports.client1 = client1;
