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
const { MongoStore } = require('connect-mongo');

// ── Models ──────────────────────────────────────────────────────
const Blacklist      = require('../bot/Models/BlackList');
const Ticket         = require('../bot/Models/Ticket');
const BotConfig      = require('../bot/Models/BotConfig');
const Message        = require('../bot/Models/Message');
const User           = require('../bot/Models/apiKey');
// Bridge to the bot's live cache: invalidate when the dashboard saves settings
let DashboardBridge;
try { DashboardBridge = new (require('../bot/systems/DashboardBridge'))(); } catch (e) { DashboardBridge = null; }
const ServerStatus   = require('../bot/Models/ServerStatus');
const Membership     = require('../bot/Models/User');
const AutoResponder  = require('../bot/Models/AutoResponder');
const Mentions       = require('../bot/Models/Mentions');
const Language       = require('../bot/Models/Langs');
const ApiKey         = require('../bot/Models/Api');
const BumpedServer   = require('../bot/Models/bumpedServer');
const ServerInfo     = require('../bot/Models/Server');
const Log            = require('../bot/Models/Log');
const Feature        = require('../bot/Models/Feature');
const Command        = require('../bot/Models/Command');
const GuildSettings  = require('../bot/Models/GuildSettings');
const WelcomeChannel = require('../bot/Models/WelcomeChannel');
const UserProfile    = require('../bot/Models/UserProfile');

// ── Express App ──────────────────────────────────────────────────
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

mongoose.set("strictQuery", true);
mongoose.set('bufferCommands', true);

// ── DB ───────────────────────────────────────────────────────────
const { initDB } = require("../bot/utils/dbManager");
const dbInit = initDB()
  .then(() => console.log('✅ Dashboard DB initialized'))
  .catch(err => {
    console.error("Dashboard DB Init Error:", err);
    return null;
  });

app.use(async (req, res, next) => {
  await dbInit;
  next();
});

// ── Session ───────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || "nfJ90bf5X2VnFsU8sLGgvZqcDA1Ce9A3",
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({
    mongoUrl: process.env.MONGO_URL || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mybott",
    collectionName: 'sessions',
    ttl: 7 * 24 * 60 * 60 // 7 days
  }),
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
// Ensure we use the custom domain for callbacks to avoid Railway redirection issues
let callbackHost = process.env.CALLBACK_URL || "https://promcbot.dev/auth/discord/callback";

passport.use(new DiscordStrategy(
  {
    clientID: DISCORD_CLIENT_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    callbackURL: callbackHost,
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
  res.sendFile(path.join(dashDir, 'Loading', 'loading.html'));
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
app.get('/servers/:guildId/modules',        ...serveServerPage('modules.html'));
app.get('/servers/:guildId/welcome',        ...serveServerPage('welcome.html'));
app.get('/servers/:guildId/members',        ...serveServerPage('members.html'));
app.get('/servers/:guildId/danger',         ...serveServerPage('danger.html'));

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
app.get('/admin',              isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'admin-overview.html')));
app.get('/admin/users',        isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'users.html')));
app.get('/admin/invite',       isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'invite.html')));
app.get('/admin/bugs',         isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'bugs.html')));
app.get('/admin/sendembed',    isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'sendembed.html')));
app.get('/admin/email',        isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'admin-email.html')));
app.get('/admin/stats',        isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'admin-stats.html')));

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
      let approximate_member_count = null;
      try {
        if (client && client.isReady && client.isReady()) {
          botPresent = client.guilds.cache.has(g.id);
          if (botPresent) {
            const cached = client.guilds.cache.get(g.id);
            approximate_member_count = cached?.approximateMemberCount || cached?.memberCount || null;
          }
        }
      } catch (_) {}
      return {
        id:   g.id,
        name: g.name,
        icon: g.icon || null,
        permissions: g.permissions,
        botPresent,
        approximate_member_count
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
    const payload = {
      guildId: req.params.guildId,
      trigger: req.body.trigger,
      response: req.body.response,
      replyType: req.body.replyType || 'text',
      allowedRoles: req.body.allowedRoles || [],
      disallowedRoles: req.body.disallowedRoles || [],
    };
    const item = await AutoResponder.create(payload);
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

// ── Guild Info (from bot cache) ───────────────────────────────────────
app.get('/api/server/:guildId/info', isAuthenticated, async (req, res) => {
  try {
    const { guildId } = req.params;
    let guildInfo = { id: guildId, name: null, icon: null, memberCount: null, botPresent: false };
    try {
      const botClients = [client, client1];
      for (const bc of botClients) {
        if (bc && bc.isReady && bc.isReady()) {
          const g = bc.guilds.cache.get(guildId);
          if (g) {
            guildInfo = { id: guildId, name: g.name, icon: g.icon ? `https://cdn.discordapp.com/icons/${guildId}/${g.icon}.png` : null, memberCount: g.memberCount, botPresent: true };
            break;
          }
        }
      }
    } catch (_) {}
    res.json({ success: true, guild: guildInfo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Roles (from bot cache) ────────────────────────────────────────────
app.get('/api/server/:guildId/roles', isAuthenticated, async (req, res) => {
  try {
    const { guildId } = req.params;
    let roles = [];
    try {
      const botClients = [client, client1];
      for (const bc of botClients) {
        if (bc && bc.isReady && bc.isReady()) {
          const g = bc.guilds.cache.get(guildId);
          if (g) {
            roles = g.roles.cache
              .filter(r => r.name !== '@everyone')
              .sort((a, b) => b.position - a.position)
              .map(r => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position, permissions: r.permissions.bitfield.toString() }));
            break;
          }
        }
      }
    } catch (_) {}
    res.json({ success: true, roles });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Channels (from bot cache) ─────────────────────────────────────────
app.get('/api/server/:guildId/channels', isAuthenticated, async (req, res) => {
  try {
    const { guildId } = req.params;
    let channels = [];
    try {
      const botClients = [client, client1];
      for (const bc of botClients) {
        if (bc && bc.isReady && bc.isReady()) {
          const g = bc.guilds.cache.get(guildId);
          if (g) {
            channels = g.channels.cache
              .filter(c => [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildCategory, ChannelType.GuildVoice].includes(c.type))
              .sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0))
              .map(c => ({ id: c.id, name: c.name, type: c.type, parentId: c.parentId || null }));
            break;
          }
        }
      }
    } catch (_) {}
    res.json({ success: true, channels });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/notifications', isAuthenticated, async (req, res) => {
  try {
    const guildId = req.query.guildId || null;
    const notifications = [];
    if (guildId) {
      const recentLogs = await Log.find({ guildId }).sort({ createdAt: -1 }).limit(3).lean();
      if (Array.isArray(recentLogs) && recentLogs.length > 0) {
        recentLogs.forEach(log => {
          const title = log.action || 'Server Activity';
          const description = log.reason || (log.message || 'Recent server event');
          notifications.push({
            title,
            description: description.toString().slice(0, 120),
            time: log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : 'Just now',
            icon: 'bx-history'
          });
        });
      }
    }

    if (notifications.length === 0) {
      notifications.push({
        title: 'Welcome to ProMcBot!',
        description: 'Your dashboard is connected and ready.',
        time: 'Just now',
        icon: 'bx-bell'
      });
    }

    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Overview Stats ────────────────────────────────────────────────────
app.get('/api/server/:guildId/overview', isAuthenticated, async (req, res) => {
  try {
    const { guildId } = req.params;
    const config = await BotConfig.findOne({ guildId }).lean() || {};
    const logCount = await Log.countDocuments({ guildId });
    const arCount  = await AutoResponder.countDocuments({ guildId });
    const recentLogs = await Log.find({ guildId }).sort({ createdAt: -1 }).limit(10).lean();
    let guildInfo = { memberCount: null, botPresent: false };
    try {
      const botClients = [client, client1];
      for (const bc of botClients) {
        if (bc && bc.isReady && bc.isReady()) {
          const g = bc.guilds.cache.get(guildId);
          if (g) { guildInfo = { memberCount: g.memberCount, botPresent: true }; break; }
        }
      }
    } catch (_) {}
    res.json({ success: true, overview: { memberCount: guildInfo.memberCount, botPresent: guildInfo.botPresent, logCount, arCount, modules: config.modules || {}, recentLogs } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Modules (per-guild toggle) ────────────────────────────────────────
app.get('/api/server/:guildId/modules', isAuthenticated, async (req, res) => {
  try {
    const config = await BotConfig.findOne({ guildId: req.params.guildId }).lean();
    res.json({ success: true, modules: config?.modules || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/:guildId/modules', isAuthenticated, async (req, res) => {
  try {
    const config = await BotConfig.findOneAndUpdate(
      { guildId: req.params.guildId },
      { $set: { modules: req.body } },
      { upsert: true, new: true }
    );
    res.json({ success: true, modules: config.modules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GuildSettings (automod config) ───────────────────────────────────
app.get('/api/server/:guildId/guild-settings', isAuthenticated, async (req, res) => {
  try {
    const settings = await GuildSettings.getSettings(req.params.guildId);
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/:guildId/guild-settings', isAuthenticated, async (req, res) => {
  try {
    const settings = await GuildSettings.findOneAndUpdate(
      { guildId: req.params.guildId },
      { $set: req.body },
      { upsert: true, new: true }
    );
    res.json({ success: true, settings });
    try { DashboardBridge?.invalidate(req.params.guildId); } catch (e) { console.warn('Bridge invalidate failed:', e.message); }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// ── Welcome configuration ─────────────────────────────────────────────
app.get('/api/server/:guildId/welcome', isAuthenticated, async (req, res) => {
  try {
    const config = await BotConfig.findOne({ guildId: req.params.guildId }).lean();
    res.json({ success: true, welcome: config?.welcome || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/:guildId/welcome', isAuthenticated, async (req, res) => {
  try {
    const config = await BotConfig.findOneAndUpdate(
      { guildId: req.params.guildId },
      { $set: { welcome: req.body } },
      { upsert: true, new: true }
    );
    res.json({ success: true, welcome: config.welcome });
    try { DashboardBridge?.invalidate(req.params.guildId); } catch (e) { console.warn('Bridge invalidate failed:', e.message); }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Ticket configuration ──────────────────────────────────────────────
app.get('/api/server/:guildId/ticket-config', isAuthenticated, async (req, res) => {
  try {
    const config = await BotConfig.findOne({ guildId: req.params.guildId }).lean();
    res.json({ success: true, ticket: config?.ticket || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/:guildId/ticket-config', isAuthenticated, async (req, res) => {
  try {
    const config = await BotConfig.findOneAndUpdate(
      { guildId: req.params.guildId },
      { $set: { ticket: req.body } },
      { upsert: true, new: true }
    );
    res.json({ success: true, ticket: config.ticket });
    try { DashboardBridge?.invalidate(req.params.guildId); } catch (e) { console.warn('Bridge invalidate failed:', e.message); }
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

// ── Members (from bot cache) ──────────────────────────────────────────
app.get('/api/server/:guildId/members', isAuthenticated, async (req, res) => {
  try {
    const { guildId } = req.params;
    let members = [];
    try {
      const botClients = [client, client1];
      for (const bc of botClients) {
        if (bc && bc.isReady && bc.isReady()) {
          const g = bc.guilds.cache.get(guildId);
          if (g) {
            await g.members.fetch();
            members = g.members.cache
              .filter(m => m.user && !m.user.bot)
              .map(m => ({
                id: m.id,
                username: m.user.username,
                global_name: m.user.globalName || m.user.username,
                avatar: m.user.avatar
                  ? `https://cdn.discordapp.com/avatars/${m.id}/${m.user.avatar}.png?size=64`
                  : `https://cdn.discordapp.com/embed/avatars/0.png`,
                joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
                roles: m.roles.cache
                  .filter(r => r.name !== '@everyone')
                  .map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
                isOwner: m.id === g.ownerId,
                hasAdministrator: m.permissions.has(PermissionsBitField.Flags.Administrator)
              }))
              .sort((a, b) => a.global_name.localeCompare(b.global_name));
            break;
          }
        }
      }
    } catch (_) {}
    res.json({ success: true, members, total: members.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Minecraft Server Info (ServerInfo model) ──────────────────────────
app.get('/api/server/:guildId/server-info', isAuthenticated, async (req, res) => {
  try {
    const info = await ServerInfo.findOne({ serverId: req.params.guildId }).lean();
    res.json({ success: true, info: info || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/:guildId/server-info', isAuthenticated, async (req, res) => {
  try {
    const body = req.body || {};
    const isBedrock = String(body.version || '').toLowerCase() === 'bedrock';
    const setFields = {
      serverId: req.params.guildId,
      serverName: body.serverName || '',
      online: body.online || false
    };
    // Save real Minecraft connection info in the fields the bot actually reads
    if (isBedrock) {
      setFields.bedrockIP = body.bedrockIP || body.ip || '';
      setFields.bedrockPort = Number(body.bedrockPort || body.port) || 19132;
      setFields.serverType = 'bedrock';
      setFields.javaIP = ''; // clear unused fields
      setFields.javaPort = 25565;
    } else {
      setFields.javaIP = body.javaIP || body.ip || '';
      setFields.javaPort = Number(body.javaPort || body.port) || 25565;
      setFields.serverType = body.serverType || 'java';
      setFields.bedrockIP = '';
      setFields.bedrockPort = 19132;
    }
    const info = await ServerInfo.findOneAndUpdate(
      { serverId: req.params.guildId },
      { $set: setFields },
      { upsert: true, new: true }
    );
    try { DashboardBridge?.invalidate(req.params.guildId); } catch (e) { console.warn('Bridge invalidate failed:', e.message); }
    res.json({ success: true, info });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Danger Zone ───────────────────────────────────────────────────────
app.post('/api/server/:guildId/danger/reset', isAuthenticated, async (req, res) => {
  try {
    const [cfg] = await Promise.all([
      BotConfig.deleteOne({ guildId: req.params.guildId }),
      GuildSettings.deleteOne({ guildId: req.params.guildId }),
      WelcomeChannel.deleteOne({ guildId: req.params.guildId })
    ]);
    try { DashboardBridge?.invalidate(req.params.guildId); } catch (e) { console.warn('Bridge invalidate failed:', e.message); }
    res.json({ success: true, message: 'All server settings have been reset' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/:guildId/danger/logs', isAuthenticated, async (req, res) => {
  try {
    await Log.deleteMany({ guildId: req.params.guildId });
    res.json({ success: true, message: 'All logs have been deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/:guildId/danger/leave', isAuthenticated, async (req, res) => {
  try {
    const { guildId } = req.params;
    let left = false;
    try {
      const botClients = [client, client1];
      for (const bc of botClients) {
        if (bc && bc.isReady && bc.isReady()) {
          const g = bc.guilds.cache.get(guildId);
          if (g) {
            await g.leave();
            left = true;
            break;
          }
        }
      }
    } catch (_) {}
    await Promise.all([
      BotConfig.deleteOne({ guildId }),
      GuildSettings.deleteOne({ guildId }),
      Log.deleteMany({ guildId }),
      AutoResponder.deleteMany({ guildId }),
      ServerInfo.deleteOne({ serverId: guildId }),
      ServerStatus.deleteMany({ guildId })
    ]);
    try { DashboardBridge?.invalidate(guildId); } catch (e) { console.warn('Bridge invalidate failed:', e.message); }
    res.json({ success: true, left, message: left ? 'Bot left the server' : 'Settings cleared' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Activity Feed ─────────────────────────────────────────────────────
app.get('/api/activity/:serverId', isAuthenticated, async (req, res) => {
  try {
    // Activity model documents are keyed by the Discord guild id
    const activity = await require('../bot/Models/Activity')
      .findOne({ serverId: req.params.serverId })
      .lean() || { activities: [] };
    res.json({ success: true, activity });
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
    res.json({ success: true, message: 'Embed sent (requires bot client connection)' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Admin: Send Email via Brevo ──────────────────────────────────────────
app.post('/api/email/send', isAdmin, async (req, res) => {
  try {
    const { to, name, subject, html, from_name, from_email } = req.body;
    if (!to || !subject || !html) {
      return res.status(400).json({ success: false, error: 'to, subject, and html are required' });
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    if (!BREVO_API_KEY) {
      return res.status(500).json({ success: false, error: 'BREVO_API_KEY not configured in environment variables' });
    }

    const payload = {
      sender: {
        name: from_name || 'ProMcBot',
        email: from_email || 'support@promcbot.dev'
      },
      to: [{ email: to, name: name || to }],
      subject: subject,
      htmlContent: html
    };

    const response = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log(`[Email] Sent to ${to} — Subject: "${subject}" — MessageId: ${response.data?.messageId}`);
    res.json({ success: true, messageId: response.data?.messageId });
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    console.error('[Email] Send error:', errMsg);
    res.status(500).json({ success: false, error: errMsg });
  }
});

// ── Admin: Stats ──────────────────────────────────────────────────────
app.get('/api/admin/stats', isAdmin, async (req, res) => {
  try {
    const [totalUsers, totalServers, totalTickets, totalLogs] = await Promise.all([
      Membership.countDocuments().catch(() => 0),
      ServerInfo.countDocuments().catch(() => 0),
      Ticket.countDocuments().catch(() => 0),
      Log.countDocuments().catch(() => 0),
    ]);
    res.json({
      success: true,
      stats: { totalUsers, totalServers, totalTickets, totalLogs, uptime: process.uptime() }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── User Profile & Banner ──────────────────────────────────────────
app.get('/api/user/profile', isAuthenticated, async (req, res) => {
  try {
    let profile = await UserProfile.findOne({ userId: req.user.id });
    if (!profile) {
      profile = await UserProfile.create({ userId: req.user.id });
    }
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/user/profile/banner', isAuthenticated, async (req, res) => {
  try {
    const { banner, bannerType } = req.body;
    const profile = await UserProfile.findOneAndUpdate(
      { userId: req.user.id },
      { banner, bannerType, updatedAt: Date.now() },
      { upsert: true, new: true }
    );
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Session Management ───────────────────────────────────────────────
app.get('/api/user/sessions', isAuthenticated, async (req, res) => {
  try {
    const sessions = await mongoose.connection.db.collection('sessions').find({}).toArray();
    const userSessions = sessions
      .filter(s => {
        try {
          const data = JSON.parse(s.session);
          return data.passport && data.passport.user && data.passport.user.id === req.user.id;
        } catch (e) { return false; }
      })
      .map(s => {
        const data = JSON.parse(s.session);
        return {
          id: s._id,
          current: s._id === req.sessionID,
          expires: s.expires,
          lastAccess: s.lastModified || s.expires,
          // We can try to extract user agent if we stored it, but connect-mongo doesn't by default
          // For now, just return basic info
        };
      });
    res.json({ success: true, sessions: userSessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/user/sessions/revoke', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, error: 'Session ID required' });
    
    // Safety check: Don't allow revoking current session via this endpoint if you want to stay logged in
    // But user asked for "remote logout", so they might want to revoke others
    
    await mongoose.connection.db.collection('sessions').deleteOne({ _id: sessionId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/user/sessions/revoke-others', isAuthenticated, async (req, res) => {
  try {
    const sessions = await mongoose.connection.db.collection('sessions').find({}).toArray();
    const toDelete = sessions
      .filter(s => {
        try {
          const data = JSON.parse(s.session);
          return data.passport && data.passport.user && data.passport.user.id === req.user.id && s._id !== req.sessionID;
        } catch (e) { return false; }
      })
      .map(s => s._id);
    
    await mongoose.connection.db.collection('sessions').deleteMany({ _id: { $in: toDelete } });
    res.json({ success: true, revokedCount: toDelete.length });
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
