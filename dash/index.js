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
const rateLimit  = require('express-rate-limit');
const { verifyGuildAccess, escapeHtml, isValidObjectId, pick } = require('./utils/security');
const { logActivity } = require('../bot/utils/auditLogger');
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
const Notification   = require('../bot/Models/Notification');
const { notifyUser, notifyUserOnce, notifyEveryone, createNotification, getInbox, markRead, markAllRead, cleanupNotifications } = require('../bot/utils/notificationSender');
const ServerInfo     = require('../bot/Models/Server');
const MinecraftConfig = require('../bot/Models/MinecraftConfig');
const McApi          = require('../bot/utils/minecraftApi');
const Log            = require('../bot/Models/Log');
const Activity       = require('../bot/Models/Activity');
const Feature        = require('../bot/Models/Feature');
const Command        = require('../bot/Models/Command');
const GuildSettings  = require('../bot/Models/GuildSettings');
const WelcomeChannel = require('../bot/Models/WelcomeChannel');
const UserProfile    = require('../bot/Models/UserProfile');
const UserFollow     = require('../bot/Models/UserFollow');

// ── Express App ──────────────────────────────────────────────────
const app = express();

// ── Security / anti-theft headers + hardening ──────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-XSS-Protection', '0');
  next();
});

// ── Rate limiting (anti brute-force / anti flood) ──────────────────
app.use(rateLimit({ windowMs: 1 * 60 * 1000, max: 120, message: { success: false, error: 'Too many requests, please slow down' } }));

// Strict CORS — only our own domain (was open to everyone)
app.use(cors({ origin: process.env.CORS_ORIGIN || 'https://promcbot.dev', credentials: true }));

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
  secret: process.env.SESSION_SECRET || nanoid(48),
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
if (process.env.WEBHOOK_ID && process.env.WEBHOOK_TOKEN) {
  try {
    webhookClient = new WebhookClient({ id: process.env.WEBHOOK_ID, token: process.env.WEBHOOK_TOKEN });
  } catch (e) {
    console.warn('⚠️ Webhook client init failed:', e.message);
  }
} else {
  console.warn('⚠️ WEBHOOK_ID/WEBHOOK_TOKEN not set — webhook logging disabled');
}


// ── Passport / Discord OAuth ────────────────────────────────────────
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
  console.error('❌ DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET are required in production — set them in Railway env');
}
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
passport.deserializeUser((user, done) => {
  if (process.env.LOCAL_DEV === '1') console.log('[auth-debug] deserializeUser:', user ? user.id : null);
  done(null, user);
});

// ── Auth Guard Middleware ────────────────────────────────────────────
// API routes MUST never receive an HTML redirect: fetch() on mobile browsers
// sends Accept: */* (no application/json), which previously caused a 302 redirect
// that fetch silently followed — returning the login HTML page instead of JSON
// and breaking every data load (overview, auto responder, moderation, ...).
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  // Any /api/* request always gets a JSON 401 (mobile-safe)
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ authenticated: false, error: 'Login required' });
  }
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
// Public assets (used by public pages like home.html) — no auth required
app.get('/dashboard/logo.png', (req, res) => res.sendFile(path.join(dashDir, 'logo.png'), { maxAge: '30d' }));
// Serve dashboard assets only to authenticated users (fixes unauthenticated file exposure)
app.use('/dashboard', isAuthenticated, express.static(dashDir));
app.use('/public', express.static(path.join(__dirname, '..', 'bot', 'public')));

// Serve shared CSS/JS (public assets only)
app.get('/shared.css', (req, res) => res.sendFile(path.join(dashDir, 'shared.css')));
app.get('/shared.js',  (req, res) => res.sendFile(path.join(dashDir, 'shared.js')));
app.get('/i18n.js',    (req, res) => res.sendFile(path.join(__dirname, 'i18n.js')));

// ── Content Security Policy ─────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://cdn.discordapp.com; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
    "img-src 'self' data: https://cdn.discordapp.com https://mc-heads.net https://lh3.googleusercontent.com https://media.tenor.com; " +
    "font-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://fonts.gstatic.com data:; " +
    "connect-src 'self' https:; frame-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';");
  next();
});

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

  // Auto-follow the bot owner on first dashboard visit
  const OWNER_ID = (process.env.OWNER_ID || '804999528129363998').split(',')[0].trim();
  if (user.id !== OWNER_ID) {
    UserFollow.updateOne(
      { followerId: user.id, followingId: OWNER_ID },
      { $setOnInsert: { followerId: user.id, followingId: OWNER_ID, createdAt: new Date() } },
      { upsert: true }
    ).catch(err => console.warn('[PMC] auto-follow failed:', err.message));
  }

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

app.get('/terms', (req, res) => {
  res.sendFile(path.join(dashDir, 'pages', 'Terms.html'));
});

app.get('/invitebot', (req, res) => {
  const clientId = DISCORD_CLIENT_ID;
  // Specific least-privilege permissions instead of Administrator (8):
  // ManageGuild(0x20)+ManageChannels(0x10)+ManageMessages(0x2000)+ManageRoles(0x10000000)
  // +SendMessages(0x800)+EmbedLinks(0x40000)+AttachFiles(0x80000)+ReadHistory(0x10000)
  // +BanMembers(0x4)+KickMembers(0x2)+ManageThreads(0x100000000000)+ViewChannel(0x400)+AddReactions(0x40)
  const perms = 274878362688;
  res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${perms}&scope=bot%20applications.commands`);
});

// ════════════════════════════════════════════════════════════════════
//  PROTECTED DASHBOARD PAGES
// ════════════════════════════════════════════════════════════════════

app.get('/docs', (req, res) => {
  res.sendFile(path.join(dashDir, 'docs.html'));
});

app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(path.join(dashDir, 'dashboard.html'));
});

app.get('/my-servers', isAuthenticated, (req, res) => {
  res.sendFile(path.join(dashDir, 'pages', 'servers.html'));
});

// Server-specific pages (require guildId param + guild membership check)
function serveServerPage(filename) {
  return [isAuthenticated, verifyGuildAccess, (req, res) => {
    res.sendFile(path.join(dashDir, 'pages', filename));
  }];
}

app.get('/my-servers/:guildId/overview',       ...serveServerPage('overview.html'));
app.get('/my-servers/:guildId/settings',       ...serveServerPage('settings.html'));
app.get('/my-servers/:guildId/moderation',     ...serveServerPage('moderation.html'));
app.get('/my-servers/:guildId/roles',          ...serveServerPage('roles.html'));
app.get('/my-servers/:guildId/logs',           ...serveServerPage('logs.html'));
app.get('/my-servers/:guildId/auto-responder', ...serveServerPage('auto_responder.html'));
app.get('/my-servers/:guildId/premium',        ...serveServerPage('premium.html'));
app.get('/my-servers/:guildId/configuration',  ...serveServerPage('configuration.html'));
app.get('/my-servers/:guildId/ticket',         ...serveServerPage('ticket.html'));
app.get('/my-servers/:guildId/modules',        ...serveServerPage('modules.html'));
app.get('/my-servers/:guildId/welcome',        ...serveServerPage('welcome.html'));
app.get('/my-servers/:guildId/members',        ...serveServerPage('members.html'));
app.get('/my-servers/:guildId/danger',         ...serveServerPage('danger.html'));
app.get('/my-servers/:guildId/players',        ...serveServerPage('players.html'));
// ── Legacy / direct page routes (backward compatibility) ─────────────
// Note: these routes lack guildId, so access relies on isAuthenticated only
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
app.get('/commands',       (req, res) => res.sendFile(path.join(dashDir, 'commands.html')));
app.get('/server-status',  isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'ServerStatus.html')));

// Real service status endpoint (bot + dashboard + API health)
app.get('/api/status', isAuthenticated, (req, res) => {
  res.json({
    success: true,
    timestamp: Date.now(),
    services: [
      { name: 'ProMcBot',        id: 'promcbot',  status: (client && client.isReady())  ? 'running' : 'offline' },
      { name: 'Dashboard Server', id: 'dashboard', status: 'running' },
      { name: 'API Server',      id: 'api-server', status: 'running' },
      { name: 'Secondary Bot',   id: 'secondary', status: (client1 && client1.isReady()) ? 'running' : 'offline' }
    ]
  });
});

// ── Admin pages ─────────────────────────────────────────────────────
app.get('/admin',              isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'admin-overview.html')));
app.get('/admin/users',        isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'users.html')));
app.get('/admin/invite',       isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'invite.html')));
app.get('/admin/bugs',         isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'bugs.html')));
app.get('/admin/sendembed',    isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'sendembed.html')));
app.get('/admin/notifications', isAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'admin-notifications.html')));
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

    // Add botPresent flag: check if the REAL bot client (global.__botClient) has this guild
    const botClient = global.__botClient || (Array.isArray(global.__dashClients) ? global.__dashClients.find(c => c && c.token) : null) || client;
    const enriched = guilds.map(g => {
      let botPresent = false;
      let approximate_member_count = null;
      try {
        if (botClient && typeof botClient.isReady === 'function' && botClient.isReady()) {
          botPresent = botClient.guilds.cache.has(g.id);
          if (botPresent) {
            const cached = botClient.guilds.cache.get(g.id);
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
app.get('/api/server/:guildId', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const config = await BotConfig.findOne({ guildId: req.params.guildId }).lean();
    let botPresent = false;
    try {
      const real = global.__botClient || (global.__dashClients && global.__dashClients.bot) || null;
      if (real && real.guilds && real.guilds.cache) {
        botPresent = !!real.guilds.cache.get(req.params.guildId);
      }
    } catch (_) {}
    res.json({ success: true, config: config || {}, botPresent });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Allowed config fields (mass assignment protection)
const BOTCONFIG_FIELDS = [
  'nickname', 'description', 'language', 'mention', 'autoRestart', 'advancedLogging',
  'customCommands', 'premiumTier', 'welcome', 'ticket', 'modules', 'logChannelId'
];

// ── Update server config ──────────────────────────────────────────────
app.post('/api/server/:guildId/config', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const config = await BotConfig.findOneAndUpdate(
      { guildId: req.params.guildId },
      { $set: pick(req.body, BOTCONFIG_FIELDS) },
            { upsert: true, new: true }
    );
    try {
      notifyUserOnce(req.user.id, { type: 'success', title: 'Configuration saved', message: `Bot configuration updated for your server.`, createdByLabel: 'Dashboard' }).catch(() => {});
    } catch (_) {}
    try { DashboardBridge?.invalidate(req.params.guildId); } catch (_) {}
    try { logActivity(req.params.guildId, { user: `${req.user.username} (Dashboard)`, action: 'Dashboard updated bot configuration' }); } catch (_) {}
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// ── Auto Responder ────────────────────────────────────────────────────
app.get('/api/server/:guildId/autoresponder', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const items = await AutoResponder.find({ guildId: req.params.guildId }).lean();
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/:guildId/autoresponder', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const payload = {
      guildId: req.params.guildId,
      trigger: String(req.body.trigger || '').slice(0, 500),
      response: String(req.body.response || '').slice(0, 2000),
      replyType: req.body.replyType || 'text',
      allowedRoles: Array.isArray(req.body.allowedRoles) ? req.body.allowedRoles.filter(id => isValidObjectId(id)).slice(0, 50) : [],
      disallowedRoles: Array.isArray(req.body.disallowedRoles) ? req.body.disallowedRoles.filter(id => isValidObjectId(id)).slice(0, 50) : [],
    };
    const item = await AutoResponder.create(payload);
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/server/:guildId/autoresponder/:id', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'INVALID_ID' });
    // Ensure the responder belongs to the same guild (cross-guild delete protection)
    const target = await AutoResponder.findOne({ _id: req.params.id, guildId: req.params.guildId }).lean();
    if (!target) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    await AutoResponder.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Logs (Audit Log — real guild events from Activity model) ─────────────
app.get('/api/server/:guildId/logs', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const page = Math.min(Math.max(1, Number(req.query.page) || 1), 100);
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 100);
    const type = req.query.type;
    const doc = await Activity.findOne({ serverId: req.params.guildId }).lean();
    let activities = (doc?.activities || []).map(a => ({
      action: escapeHtml(a.action || 'Event'),
      user: escapeHtml(a.user || 'Unknown'),
      reason: escapeHtml(a.reason || ''),
      createdAt: a.timestamp || new Date()
    }));
    if (type) {
      activities = activities.filter(a =>
        (a.action || '').toLowerCase().includes(String(type).toLowerCase())
      );
    }
    // newest first (newest entries are pushed at position 0)
    activities.reverse();
    const total = activities.length;
    const start = (Number(page) - 1) * Number(limit);
    const logs = activities.slice(start, start + Number(limit));
    res.json({ success: true, logs, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// ── Log Channel Settings (separate from audit events: where logs go) ────
app.get('/api/server/:guildId/log-channels', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const doc = await Log.findOne({ serverId: req.params.guildId }).lean();
    res.json({ success: true, settings: doc?.logs || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Guild Info (from bot cache) ───────────────────────────────────────
app.get('/api/server/:guildId/info', [isAuthenticated, verifyGuildAccess], async (req, res) => {
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
app.get('/api/server/:guildId/roles', [isAuthenticated, verifyGuildAccess], async (req, res) => {
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
app.get('/api/server/:guildId/channels', [isAuthenticated, verifyGuildAccess], async (req, res) => {
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

// ── Overview Stats ────────────────────────────────────────────────────
app.get('/api/server/:guildId/overview', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const { guildId } = req.params;
    const config = await BotConfig.findOne({ guildId }).lean() || {};
    const logCount = await Log.countDocuments({ guildId });
    const arCount  = await AutoResponder.countDocuments({ guildId });
    const recentLogs = await Log.find({ guildId }).sort({ createdAt: -1 }).limit(10).lean();
    let guildInfo = { memberCount: null, botPresent: false };
    try {
      const realBot = global.__botClient || null;
      const botClients = realBot ? [realBot, ...[client, client1].filter(Boolean)] : [client, client1];
      for (const bc of botClients) {
        if (bc && bc.isReady && bc.isReady()) {
          const g = bc.guilds.cache.get(guildId);
          if (g) { guildInfo = { memberCount: g.approximateMemberCount ?? g.memberCount, botPresent: true }; break; }
        }
      }
    } catch (_) {}
    res.json({ success: true, overview: { memberCount: guildInfo.memberCount, botPresent: guildInfo.botPresent, logCount, arCount, modules: config.modules || {}, recentLogs } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Modules (per-guild toggle) ────────────────────────────────────────
app.get('/api/server/:guildId/modules', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const config = await BotConfig.findOne({ guildId: req.params.guildId }).lean();
    res.json({ success: true, modules: config?.modules || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/:guildId/modules', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const config = await BotConfig.findOneAndUpdate(
      { guildId: req.params.guildId },
      { $set: { modules: req.body } },
      { upsert: true, new: true }
    );
    try {
      notifyUserOnce(req.user.id, { type: 'success', title: 'Modules updated', message: `Server modules changed.`, createdByLabel: 'Dashboard' }).catch(() => {});
    } catch (_) {}
    try { DashboardBridge?.invalidate(req.params.guildId); } catch (_) {}
    try { logActivity(req.params.guildId, { user: `${req.user.username} (Dashboard)`, action: `Dashboard toggled modules: ${Object.keys(req.body || {}).slice(0, 5).join(', ') || 'none'}` }); } catch (_) {}
    res.json({ success: true, modules: config.modules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GuildSettings (automod config) ───────────────────────────────────
app.get('/api/server/:guildId/guild-settings', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const settings = await GuildSettings.getSettings(req.params.guildId);
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/:guildId/guild-settings', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const settings = await GuildSettings.findOneAndUpdate(
      { guildId: req.params.guildId },
      { $set: req.body },
      { upsert: true, new: true }
    );
    try {
      notifyUserOnce(req.user.id, { type: 'success', title: 'AutoMod settings saved', message: `Guild settings updated.`, createdByLabel: 'Dashboard' }).catch(() => {});
    } catch (_) {}
    res.json({ success: true, settings });
    try { DashboardBridge?.invalidate(req.params.guildId); } catch (e) { console.warn('Bridge invalidate failed:', e.message); }
    try { logActivity(req.params.guildId, { user: `${req.user.username} (Dashboard)`, action: 'Dashboard updated AutoMod settings' }); } catch (_) {}
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// ── Welcome configuration ─────────────────────────────────────────────
app.get('/api/server/:guildId/welcome', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const config = await BotConfig.findOne({ guildId: req.params.guildId }).lean();
    res.json({ success: true, welcome: config?.welcome || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/:guildId/welcome', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const config = await BotConfig.findOneAndUpdate(
      { guildId: req.params.guildId },
      { $set: { welcome: req.body } },
      { upsert: true, new: true }
    );
    notifyUserOnce(req.user.id, { type: 'success', title: 'Welcome message saved', message: `Welcome config updated for your server.`, createdByLabel: 'Dashboard' }).catch(() => {});
    try { logActivity(req.params.guildId, { user: `${req.user.username} (Dashboard)`, action: 'Dashboard updated welcome settings' }); } catch (_) {}
    res.json({ success: true, welcome: config.welcome });
    try { DashboardBridge?.invalidate(req.params.guildId); } catch (e) { console.warn('Bridge invalidate failed:', e.message); }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Ticket configuration ──────────────────────────────────────────────
app.get('/api/server/:guildId/ticket-config', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const config = await BotConfig.findOne({ guildId: req.params.guildId }).lean();
    res.json({ success: true, ticket: config?.ticket || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/:guildId/ticket-config', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const config = await BotConfig.findOneAndUpdate(
      { guildId: req.params.guildId },
      { $set: { ticket: req.body } },
      { upsert: true, new: true }
    );
    notifyUserOnce(req.user.id, { type: 'success', title: 'Ticket settings saved', message: `Ticket configuration updated.`, createdByLabel: 'Dashboard' }).catch(() => {});
    try { logActivity(req.params.guildId, { user: `${req.user.username} (Dashboard)`, action: 'Dashboard updated ticket settings' }); } catch (_) {}
    res.json({ success: true, ticket: config.ticket });
    try { DashboardBridge?.invalidate(req.params.guildId); } catch (e) { console.warn('Bridge invalidate failed:', e.message); }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Blacklist ─────────────────────────────────────────────────────────
app.get('/api/server/:guildId/blacklist', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const list = await Blacklist.find({ guildId: req.params.guildId }).lean();
    res.json({ success: true, list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Members (from bot cache) ──────────────────────────────────────────
app.get('/api/server/:guildId/members', [isAuthenticated, verifyGuildAccess], async (req, res) => {
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

// ════════════════════════════════════════════════════════════════════
//  Minecraft Hub — mc-info, player lookup, live server status
// ════════════════════════════════════════════════════════════════════

// ── Minecraft Saved Info (ServerInfo model) — READ ──────────────────
app.get('/api/server/:guildId/mc-info', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const [info, mcCfg] = await Promise.all([
      ServerInfo.findOne({ serverId: req.params.guildId }).lean(),
      MinecraftConfig.findOne({ guildId: req.params.guildId }).lean()
    ]);
    res.json({
      success: true,
      info: info || {},
      // Expose connection status only (never the bearer token)
      mcConfig: mcCfg ? { apiUrl: mcCfg.apiUrl, connected: true, updatedAt: mcCfg.updatedAt } : null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Minecraft Saved Info (ServerInfo model) — WRITE ─────────────────
app.post('/api/server/:guildId/mc-info', [isAuthenticated, verifyGuildAccess], async (req, res) => {
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
    try { logActivity(req.params.guildId, { user: `${req.user.username} (Dashboard)`, action: `Dashboard saved Minecraft server info (${setFields.serverName || setFields.serverType})` }); } catch (_) {}
    notifyUserOnce(req.user.id, { type: 'success', title: 'Settings saved', message: `Minecraft server info saved (${req.params.guildId}).`, createdByLabel: 'Dashboard' }).catch(() => {});
    res.json({ success: true, info });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Danger Zone ───────────────────────────────────────────────────────
app.post('/api/server/:guildId/danger/reset', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const [cfg] = await Promise.all([
      BotConfig.deleteOne({ guildId: req.params.guildId }),
      GuildSettings.deleteOne({ guildId: req.params.guildId }),
      WelcomeChannel.deleteOne({ guildId: req.params.guildId })
    ]);
        try { DashboardBridge?.invalidate(req.params.guildId); } catch (e) { console.warn('Bridge invalidate failed:', e.message); }
    try { logActivity(req.params.guildId, { user: `${req.user.username} (Dashboard)`, action: 'Dashboard reset ALL server settings (Danger Zone)' }); } catch (_) {}
    res.json({ success: true, message: 'All server settings have been reset' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/server/:guildId/danger/logs', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    await Log.deleteMany({ guildId: req.params.guildId });
    try { logActivity(req.params.guildId, { user: `${req.user.username} (Dashboard)`, action: 'Dashboard deleted all log-channel settings' }); } catch (_) {}
    res.json({ success: true, message: 'All logs have been deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/server/:guildId/danger/leave', [isAuthenticated, verifyGuildAccess], async (req, res) => {
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
    try { logActivity(guildId, { user: `${req.user.username} (Dashboard)`, action: 'Dashboard removed bot from server (Danger Zone — leave)' }); } catch (_) {}
    res.json({ success: true, left, message: left ? 'Bot left the server' : 'Settings cleared' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Activity Feed ─────────────────────────────────────────────────────
app.get('/api/activity/:serverId', [isAuthenticated, verifyGuildAccess], async (req, res) => {
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
app.get('/api/server/:guildId/minecraft-status', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const status = await ServerStatus.find({ guildId: req.params.guildId }).lean();
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Minecraft Player Lookup (real data from the MC server API) ──────
app.get('/api/server/:guildId/player/:username', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const username = decodeURIComponent(req.params.username).trim();
    if (!username || username.length > 16) {
      return res.status(400).json({ success: false, error: 'INVALID_USERNAME' });
    }
    const data = await McApi.getPlayer(req.params.guildId, username);
    const isOnline = Boolean(data && data.isOnline);
    res.json({
      success: true,
      player: {
        username: data.username || username,
        uuid: data.uuid || null,
        isOnline,
        world: data.world || null,
        ping: data.ping ?? null,
        totalPlaytimeSeconds: data.totalPlaytimeSeconds || 0,
        formattedPlaytime: data.formattedPlaytime || null,
        sessionPlaytimeSeconds: data.sessionPlaytimeSeconds || 0,
        accountType: data.accountType || null,
        isBanned: Boolean(data.isBanned)
      }
    });
  } catch (err) {
    if (err && err.message === 'NO_MC_CONFIG') {
      return res.status(404).json({ success: false, error: 'NO_MC_CONFIG', message: 'لم يتم ربط سيرفر ماين كرافت بعد' });
    }
    if (err && err.response && err.response.status === 404) {
      return res.status(404).json({ success: false, error: 'NOT_IN_SERVER', message: 'اللاعب لم يدخل سيرفر ماين كرافت من قبل' });
    }
    if (err && err.response && err.response.status === 401) {
      return res.status(401).json({ success: false, error: 'MC_AUTH_FAILED', message: 'خطأ في مصادقة سيرفر ماين كرافت' });
    }
    if (err && err.response && err.response.status === 403) {
      return res.status(403).json({ success: false, error: 'MC_PREMIUM_KEY_REQUIRED', message: 'Premium Key مطلوب من سيرفر الماين كرافت — أعد /mc-setup لتوليد مفتاح ProMcSecure' });
    }
    res.status(500).json({ success: false, error: err.message || 'MC_LOOKUP_FAILED' });
  }
});

// ════════════════════════════════════════════════════════════════════
//  PUBLIC USER PROFILES /u/:userId + Follow system
// ════════════════════════════════════════════════════════════════════

// Public profile page
app.get('/u/:userId', (req, res) => {
  res.sendFile(path.join(dashDir, 'pages', 'user-profile.html'));
});

// Public profile data — Discord account info (resolved via bot REST so we never expose tokens)
app.get('/api/u/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!/^\d{15,22}$/.test(userId)) {
      return res.status(400).json({ success: false, error: 'INVALID_USER_ID' });
    }
    const botClients = Array.isArray(global.__dashClients) ? global.__dashClients : [];
    let discordUser = null;
    // LOCAL_DEV fallback: serve a fake profile for the dev user so the profile page can be tested locally
    if (process.env.LOCAL_DEV === '1' && userId === '123456789012345678') {
      discordUser = { id: '123456789012345678', username: 'DevUser', discriminator: '0001', avatar: null, banner: null, global_name: 'Dev User' };
    }
    for (const c of botClients) {
      if (c && c.token) {
        try {
          const resp = await fetch(`https://discord.com/api/v10/users/${userId}`, {
            headers: { Authorization: `Bot ${c.token}` }
          });
          if (resp.ok) { discordUser = await resp.json(); break; }
          if (resp.status === 404) break; // user genuinely not found
        } catch (_) {}
      }
    }
    if (!discordUser) {
      return res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });
    }
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${discordUser.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${(Number(discordUser.discriminator) || 0) % 5}.png`;

    let bannerUrl = null;
    if (discordUser.banner) {
      bannerUrl = `https://cdn.discordapp.com/banners/${discordUser.id}/${discordUser.banner}.${discordUser.banner.startsWith('a_') ? 'gif' : 'png'}?size=1024`;
    }

    const [followers, following] = await Promise.all([
      UserFollow.countDocuments({ followingId: userId }),
      UserFollow.countDocuments({ followerId: userId })
    ]);

    let isFollowing = false;
    let isOwn = false;
    if (req.isAuthenticated()) {
      isOwn = req.user.id === userId;
      if (!isOwn) {
        const f = await UserFollow.findOne({ followerId: req.user.id, followingId: userId });
        isFollowing = !!f;
      }
    }

    // Custom profile extras (banner/colors)
    let extras = {};
    try {
      const profile = await UserProfile.findOne({ userId }).lean();
      if (profile) {
        if (profile.banner && profile.bannerType === 'image') extras.bannerImage = profile.banner;
        if (profile.banner && profile.bannerType === 'color') extras.bannerColor = profile.banner;
        extras.customStatus = profile.customStatus || '';
      }
    } catch (_) {}

    res.json({
      success: true,
      userId,
      username: discordUser.username,
      globalName: discordUser.global_name || discordUser.username,
      discriminator: discordUser.discriminator,
      avatar: avatarUrl,
      banner: bannerUrl,
      bannerAccent: discordUser.banner_color || null,
      followers,
      following,
      isFollowing,
      isOwn,
      extras
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Toggle follow (protected)
app.post('/api/u/:userId/follow', isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!/^\d{15,22}$/.test(userId)) {
      return res.status(400).json({ success: false, error: 'INVALID_USER_ID' });
    }
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, error: 'CANNOT_FOLLOW_SELF' });
    }
    const owner = (process.env.OWNER_ID || '804999528129363998').split(',')[0].trim();
    if (userId === owner) {
      return res.status(400).json({ success: false, error: 'CANNOT_FOLLOW_OWNER' });
    }
    const existing = await UserFollow.findOne({ followerId: req.user.id, followingId: userId });
    if (existing) {
      await UserFollow.deleteOne({ _id: existing._id });
      return res.json({ success: true, following: false });
    }
    await UserFollow.create({ followerId: req.user.id, followingId: userId });
    res.json({ success: true, following: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


app.get('/mc-lookup', (req, res) => res.sendFile(path.join(dashDir, 'pages', 'mc-lookup.html')));

// ── Public tools: MC Server Lookup ────────────────────────────────────
// Free public tool: any Minecraft address (player.mcsrv.net, hypixel.net:25565, ...)
// Proxy to mcsrvstat.us so we never expose the third-party API directly
app.get('/api/mc/:addr', async (req, res) => {
  try {
    const addr = decodeURIComponent(req.params.addr).trim();
    if (!addr || addr.length > 120) return res.status(400).json({ ok: false, error: 'Invalid address' });
    const r = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(addr)}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(400).json({ ok: false, error: 'Lookup failed' });
    const data = await r.json();
    // mcsrvstat.us returns {ok: true/false}; pass data through minus the internal ok flag
    const { ok, ...rest } = data;
    if (!ok) return res.json({ ok: false, error: 'SERVER_NOT_FOUND', ...rest });
    res.json({ ok: true, ...rest });
  } catch (err) {
    res.status(502).json({ ok: false, error: 'Status service unavailable' });
  }
});

// ── Minecraft Live Server Status (/info from MC API) ────────────────
app.get('/api/server/:guildId/mc-status-live', [isAuthenticated, verifyGuildAccess], async (req, res) => {
  try {
    const data = await McApi.getServerInfo(req.params.guildId);
    res.json({ success: true, status: data });
  } catch (err) {
    if (err && err.message === 'NO_MC_CONFIG') {
      return res.status(404).json({ success: false, error: 'NO_MC_CONFIG', message: 'لم يتم ربط سيرفر ماين كرافت بعد' });
    }
    if (err && err.response && err.response.status === 403) {
      return res.status(403).json({ success: false, error: 'MC_PREMIUM_KEY_REQUIRED', message: 'Premium Key مطلوب من سيرفر الماين كرافت — أعد /mc-setup لتوليد مفتاح ProMcSecure' });
    }
    res.status(500).json({ success: false, error: err.message || 'MC_STATUS_FAILED' });
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

// ── Admin: Send Embed (real send via bot client) ─────────────────────
app.post('/api/admin/sendembed', isAdmin, async (req, res) => {
  try {
    const { guildId, channelId, title, description, color, image, footer, fields } = req.body;
    if (!channelId) return res.status(400).json({ success: false, error: 'channelId required' });
    if (!client || !client.isReady()) return res.status(503).json({ success: false, error: 'Bot offline' });
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });
    if (!channel.isTextBased() || !channel.isSendable())
      return res.status(400).json({ success: false, error: 'Cannot send to this channel' });

    const embed = new EmbedBuilder();
    if (title) embed.setTitle(title.slice(0, 256));
    if (description) embed.setDescription(description.slice(0, 4096));
    if (color) embed.setColor(color.startsWith('#') ? color : '#' + color);
    if (image && /^https?:\/\//.test(image)) embed.setImage(image);
    if (footer) embed.setFooter({ text: String(footer).slice(0, 2048) });
    if (Array.isArray(fields)) {
      fields.slice(0, 25).forEach(f => {
        if (f && f.value) embed.addFields({ name: String(f.name || '').slice(0, 256), value: String(f.value).slice(0, 1024), inline: !!f.inline });
      });
    }
    await channel.send({ embeds: [embed] });
    console.log(`[Admin] Embed sent to #${channel.name} in guild ${guildId || channel.guild?.id || '?'}`);
    res.json({ success: true, message: 'Embed sent' });
  } catch (err) {
    console.error('[Admin] sendembed error:', err.message);
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
//  NOTIFICATION SYSTEM (Admin Panel)
// ════════════════════════════════════════════════════════════════════

// ── Admin: Am I an admin? (client-side needs this) ───────────────────────
app.get('/api/admin/me', isAuthenticated, (req, res) => {
  const adminIds = (process.env.OWNER_ID || '804999528129363998').split(',');
  res.json({ isAdmin: adminIds.includes(req.user.id), user: req.user.id });
});


// ════════════════════════════════════════════════════════════════════
// ── In-app Notifications (dashboard navbar bell inbox) ─────────────────
// Users see notifications INSIDE the dashboard. NOT Discord messages. ──

// Admin: list all created announcements
app.get('/api/admin/notifications', isAdmin, async (req, res) => {
  try {
    const notifications = await Notification.find({ createdBy: { $ne: null } })
      .sort({ pinned: -1, createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: create an in-app announcement (everyone / specific user / admin-only)
app.post('/api/admin/notifications/send', isAdmin, async (req, res) => {
  try {
    const { recipientId, forAdmin, type, title, message, actionUrl, actionLabel } = req.body || {};
    if (!title || !message) return res.status(400).json({ success: false, error: 'title + message required' });
    const doc = await Notification.create({
      recipientId: recipientId || null,
      forAdmin: !!forAdmin,
      createdBy: req.user.id,
      createdByLabel: req.user.username || req.user.global_name || 'Admin',
      type: ['info', 'success', 'warning', 'error'].includes(type) ? type : 'info',
      title: escapeHtml(String(title).slice(0, 256)),
      message: escapeHtml(String(message).slice(0, 4000)),
      actionUrl: actionUrl || null,
      actionLabel: actionLabel || null
    });
    try { logActivity('admin', { user: `${req.user.username} (Admin)`, action: `Dashboard sent announcement: ${String(title).slice(0, 80)}` }); } catch (_) {}
    res.json({ success: true, notification: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: toggle pin / delete
app.post('/api/admin/notifications/:id/pin', isAdmin, async (req, res) => {
  try {
    const doc = await Notification.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
    doc.pinned = !doc.pinned;
    await doc.save();
    res.json({ success: true, pinned: doc.pinned });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/notifications/:id', isAdmin, async (req, res) => {
  try {
    await Notification.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// User inbox: personal + everyone (admin sees forAdmin too)
app.get('/api/notifications/inbox', isAuthenticated, async (req, res) => {
  try {
    const adminIds = (process.env.OWNER_ID || '804999528129363998').split(',');
    const inbox = await getInbox(req.user.id, { isAdmin: adminIds.includes(req.user.id) });
    res.json({ success: true, ...inbox });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/notifications/unread', isAuthenticated, async (req, res) => {
  try {
    const adminIds = (process.env.OWNER_ID || '804999528129363998').split(',');
    const { unread } = await getInbox(req.user.id, { isAdmin: adminIds.includes(req.user.id) });
    res.json({ success: true, unread: Math.min(unread, 99) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/notifications/read', isAuthenticated, async (req, res) => {
  try {
    const ok = await markRead((req.body || {}).id, req.user.id);
    res.json({ success: ok });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/notifications/read-all', isAuthenticated, async (req, res) => {
  try {
    await markAllRead(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Periodic cleanup: remove expired/old read notifications
setInterval(() => cleanupNotifications().then(n => n && console.log(`[Notifications] cleaned ${n} old items`)).catch(() => {}), 3600000).unref();

// ── Bug reports (server-side webhook, no token exposure in HTML) ───────────
app.post('/api/bugs/submit', isAuthenticated, async (req, res) => {
  try {
    const { embeds, content } = req.body || {};
    if (!Array.isArray(embeds) || !embeds.length) return res.status(400).json({ success: false, error: 'Missing embeds' });
    const sanitized = embeds.slice(0, 3).map(e => ({
      title: String(e.title || '').slice(0, 200),
      color: Number.isFinite(e.color) ? e.color : 0x5865F2,
      fields: (Array.isArray(e.fields) ? e.fields : []).slice(0, 10).map(f => ({
        name: String(f.name || '').slice(0, 100),
        value: String(f.value || '').slice(0, 500),
        inline: !!f.inline
      })),
      footer: e.footer ? { text: String(e.footer.text || '').slice(0, 100) } : undefined,
      timestamp: e.timestamp || undefined
    }));
    const webhookClientLocal = webhookClient || new WebhookClient({ id: process.env.BUG_WEBHOOK_ID, token: process.env.BUG_WEBHOOK_TOKEN });
    await webhookClientLocal.send({ embeds: sanitized, content: String(content || '').slice(0, 500) }).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Notifications: guild roles & channels (for targeting) ──────────────────
app.get('/api/admin/guild/:guildId/channels', isAuthenticated, async (req, res) => {
  try {
    if (!client || !client.isReady()) return res.status(503).json({ success: false, error: 'Bot offline' });
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ success: false, error: 'Guild not cached' });
    const channels = await guild.channels.fetch({ cache: false }).catch(() => new Map());
    const list = Array.from(channels.values())
      .filter(c => c.type === 0)
      .map(c => ({ id: c.id, name: c.name }));
    res.json({ success: true, channels: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/guild/:guildId/roles', isAuthenticated, async (req, res) => {
  try {
    if (!client || !client.isReady()) return res.status(503).json({ success: false, error: 'Bot offline' });
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ success: false, error: 'Guild not cached' });
    const list = guild.roles.cache.map(r => ({ id: r.id, name: r.name, color: '#' + (r.color || 0).toString(16).padStart(6, '0') }));
    res.json({ success: true, roles: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── LOCAL DEVELOPMENT ROUTES (never enabled in production) ─────────────
// LOCAL_DEV is only set by local-dev.js; Railway production never sets it.
if (process.env.LOCAL_DEV === '1') {
  app.get('/__dev-create', (req, res) => {
    // Create an authenticated session for local UI testing without Discord OAuth.
    const fakeProfile = {
      id: process.env.LOCAL_DEV_USER_ID || '123456789012345678',
      username: 'localdev',
      discriminator: '0',
      avatar: null,
      global_name: 'Local Dev',
      email: 'dev@example.com',
      guilds: [
        { id: process.env.LOCAL_DEV_GUILD_ID || '1059183076636372993', name: 'Test Server', icon: null, permissions: (0x8 | 0x20).toString() }
      ],
      lastLogin: Date.now()
    };
    req.login(fakeProfile, () => {
      res.json({ ok: true, user: fakeProfile.id, sid: req.sessionID });
    });
  });
  app.get('/__dev-session', (req, res) => {
    res.json({
      sessionLoaded: !!req.session,
      sid: req.sessionID || null,
      cookieSid: req.signedCookies && req.signedCookies.sid,
      user: req.user ? { id: req.user.id, guilds: (req.user.guilds || []).map(g => g.id) } : null,
      isAuthenticated: req.isAuthenticated(),
      envSecret: process.env.SESSION_SECRET ? 'env-set' : 'undefined'
    });
  });
  app.get('/__dev-auth-check', (req, res) => {
    if (req.isAuthenticated()) {
      return res.json({ authViaMiddleware: true, user: req.user ? { id: req.user.id, guildCount: (req.user.guilds || []).length } : null });
    }
    res.status(401).json({ authenticated: false });
  });
}

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
// Expose dashboard bot clients so security.js can fall back to bot-cache
// membership checks when Discord OAuth guilds are stale (e.g. new guilds).
// Global handle so dash/utils/security.js (no direct access to clients)
// can fall back to bot-cache membership when OAuth guilds are stale.
global.__dashClients = [client, client1].filter(Boolean);
module.exports.app    = app;
module.exports.client  = client;
module.exports.client1 = client1;

// ════════════════════════════════════════════════════════════════════
