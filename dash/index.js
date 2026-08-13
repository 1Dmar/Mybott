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
const MongoStore = require('connect-mongo');

// ── Models ──────────────────────────────────────────────────────
const ServerInfo     = require('../bot/Models/Server');
const GuildSettings  = require('../bot/Models/GuildSettings');
const UserProfile    = require('../bot/Models/UserProfile');

// ── Express App ──────────────────────────────────────────────────
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Trust proxy for Railway/Cloudflare
app.set('trust proxy', 1);

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
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URL || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mybott",
    collectionName: 'sessions',
    ttl: 7 * 24 * 60 * 60 // 7 days
  }),
  cookie: { 
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Discord Client ────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const BOT_TOKEN = process.env.BOT1_1_TOKEN;
if (BOT_TOKEN) {
  client.login(BOT_TOKEN)
    .then(() => console.log('✅ Dashboard Discord client ready'))
    .catch(e => console.warn('⚠️ Discord login failed:', e.message));
}

// ── Passport / Discord OAuth ────────────────────────────────────────
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1220005260857311294";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "KWAY2Bw_eJ4ZVHWDwgoJ3ZRVPAqv9o7G";
const CALLBACK_URL = process.env.CALLBACK_URL || "https://promcbot.dev/auth/discord/callback";

passport.use(new DiscordStrategy({
    clientID: DISCORD_CLIENT_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    scope: ["identify", "guilds", "email"],
  },
  async (accessToken, refreshToken, profile, done) => {
    profile.accessToken = accessToken;
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ── Auth Guard ──────────────────────────────────────────────────────
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ authenticated: false });
  }
  res.redirect('/loading-auth');
}

// ── Static Files ─────────────────────────────────────────────────────
const dashDir = path.join(__dirname, 'dashboard');
app.use('/dashboard', express.static(dashDir));
app.use('/public', express.static(path.join(__dirname, '..', 'bot', 'public')));

// ── Routes ───────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(dashDir, 'home.html')));
app.get('/loading-auth', (req, res) => res.sendFile(path.join(dashDir, 'Loading', 'loading.html')));

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
  res.redirect('/dashboard');
});

app.get('/api/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

app.get('/callback/check/userData', (req, res) => {
  if (!req.isAuthenticated()) return res.json({ authenticated: false });
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      global_name: req.user.global_name || req.user.username,
      avatar: `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`,
      guilds: req.user.guilds
    }
  });
});

// Dashboard Protected Pages
app.get('/dashboard', isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'dashboard.html')));
app.get('/servers', isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'servers.html')));

// Dynamic Server Pages
const serverPages = ['overview', 'settings', 'moderation', 'roles', 'logs', 'modules', 'welcome', 'premium', 'configuration', 'ticket', 'bugs'];
serverPages.forEach(page => {
  app.get(`/servers/:guildId/${page}`, isAuthenticated, (req, res) => {
    const filePath = path.join(dashDir, 'pages', `${page}.html`);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).sendFile(path.join(dashDir, '404', '404.html'));
    }
  });
});

// Shared Assets
app.get('/shared.css', (req, res) => res.sendFile(path.join(dashDir, 'shared.css')));
app.get('/shared.js', (req, res) => res.sendFile(path.join(dashDir, 'shared.js')));

// 404 Handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(dashDir, '404', '404.html'));
});

module.exports = { app };
