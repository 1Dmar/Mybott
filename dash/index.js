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
const { MongoStore } = require('connect-mongo');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const TelemetryEvent = require('../bot/Models/TelemetryEvent');
const PluginInstance = require('../bot/Models/PluginInstance');
const PluginCredential = require('../bot/Models/PluginCredential');
const { authenticatePluginRequest, encryptSecret, hashToken } = require('../bot/utils/pluginSecurity');
const AutomationRule = require('../bot/Models/AutomationRule');
const AutomationExecution = require('../bot/Models/AutomationExecution');
const { summarizeTelemetry, WINDOW_MS } = require('../bot/utils/intelligenceEngine');
const { runEnabledRules } = require('../bot/utils/automationEngine');
const { PLANS, getPlan } = require('../bot/utils/entitlements');

// ── Models ──────────────────────────────────────────────────────
const ServerInfo     = require('../bot/Models/Server');
const GuildSettings  = require('../bot/Models/GuildSettings');
const UserProfile    = require('../bot/Models/UserProfile');

// ── Express App ──────────────────────────────────────────────────
const app = express();

app.use(cors());
app.use(express.json({
  limit: '512kb',
  verify: (req, res, buffer) => {
    if (req.path === '/api/v1/telemetry/events') req.rawBody = Buffer.from(buffer);
  }
}));
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

// First-party Minecraft plugin telemetry. Signature verification uses the exact raw body.
app.post('/api/v1/telemetry/events', rateLimit({ windowMs: 60 * 1000, max: 120 }), async (req, res) => {
  try {
    const auth = await authenticatePluginRequest(req, req.rawBody || Buffer.from(''));
    if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error });
    const incoming = Array.isArray(req.body?.events) ? req.body.events.slice(0, 250) : [];
    if (!incoming.length) return res.status(400).json({ success: false, error: 'events_required' });
    const now = Date.now();
    const documents = incoming.map((event, index) => {
      const occurredAt = new Date(event.occurredAt || now);
      if (Number.isNaN(occurredAt.getTime())) throw new Error('invalid_occurredAt');
      const data = (event.data && typeof event.data === 'object' && !Array.isArray(event.data)) ? event.data : {};
      const safeData = Object.fromEntries(Object.entries(data).slice(0, 32).map(([key, value]) => [String(key).slice(0, 64), typeof value === 'string' ? value.slice(0, 512) : (typeof value === 'number' || typeof value === 'boolean' ? value : String(value).slice(0, 512))]));
      return { serverId: auth.serverId, instanceId: auth.instanceId, type: String(event.type || 'unknown').slice(0, 64), occurredAt, receivedAt: new Date(now), requestId: `${req.get('x-promcbot-nonce')}:${index}`, data: safeData, expiresAt: new Date(now + 90 * 24 * 60 * 60 * 1000) };
    });
    await TelemetryEvent.insertMany(documents, { ordered: false });
    const latestCount = documents.map(d => d.type === 'player_count' ? Number(d.data.onlinePlayers) : NaN).find(Number.isFinite);
    await PluginInstance.findOneAndUpdate({ serverId: auth.serverId, instanceId: auth.instanceId }, { $set: { protocolVersion: auth.protocolVersion, lastSeenAt: new Date(), status: 'online', ...(latestCount === undefined ? {} : { lastOnlinePlayers: Math.max(0, latestCount) }) }, $setOnInsert: { firstSeenAt: new Date() } }, { upsert: true });
    res.status(202).json({ success: true, accepted: documents.length, serverId: auth.serverId, instanceId: auth.instanceId });
  } catch (error) {
    if (error?.code === 11000) return res.status(202).json({ success: true, accepted: 0, duplicate: true });
    if (error?.message === 'invalid_occurredAt') return res.status(400).json({ success: false, error: error.message });
    console.error('[plugin telemetry] error:', error.message);
    res.status(500).json({ success: false, error: 'telemetry_ingest_failed' });
  }
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
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) console.warn('⚠️ Discord OAuth credentials are not configured; dashboard login is unavailable.');
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

function canManageGuild(req, guildId) {
  if (!req.user?.id || !guildId) return false;
  const ownerIds = String(process.env.OWNER_ID || '').split(',').map(id => id.trim()).filter(Boolean);
  if (ownerIds.includes(req.user.id)) return true;
  const guild = (req.user.guilds || []).find(item => item.id === guildId);
  if (!guild) return false;
  try {
    const permissions = BigInt(guild.permissions || 0);
    return (permissions & BigInt(0x8)) === BigInt(0x8) || (permissions & BigInt(0x20)) === BigInt(0x20);
  } catch (_) { return false; }
}

function requireGuildManager(req, res, next) {
  if (!canManageGuild(req, req.params.guildId)) return res.status(403).json({ success: false, error: 'guild_access_required' });
  next();
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

// ── User API ──────────────────────────────────────────────────────
app.get('/api/user/profile', isAuthenticated, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      global_name: req.user.global_name || req.user.username,
      avatar: `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`,
      banner: null,
      accent_color: req.user.accent_color || '#FF512F'
    }
  });
});

app.get('/api/user/sessions', isAuthenticated, (req, res) => {
  res.json({ success: true, sessions: [{ id: 'current', current: true, ip: req.ip, device: 'Web Browser' }] });
});

app.get('/api/user/membership', isAuthenticated, async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ userId: req.user.id });
    const isPremium = !!(profile && profile.premiumUntil > Date.now());
    res.json({ success: true, membership: { plan: isPremium ? 'premium' : 'free' } });
  } catch (e) {
    res.json({ success: true, membership: { plan: 'free' } });
  }
});

app.get('/api/guilds/:guildId/entitlements', isAuthenticated, requireGuildManager, async (req, res) => {
  const settings = await GuildSettings.findOne({ guildId: req.params.guildId }).lean().catch(() => null);
  const plan = getPlan(settings?.plan || 'free');
  res.json({ success: true, plan, availablePlans: Object.values(PLANS), billing: { implemented: false, note: 'Entitlements are currently configuration-based; payment processing is not implemented.' } });
});

// ── Guild API ─────────────────────────────────────────────────────
app.get('/api/guilds', isAuthenticated, (req, res) => {
  res.json({ success: true, guilds: req.user.guilds || [] });
});

app.get('/api/guilds/:guildId/settings', isAuthenticated, async (req, res) => {
  try {
    const settings = await GuildSettings.findOne({ guildId: req.params.guildId }) || { prefix: '!', language: 'en' };
    res.json({ success: true, settings });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/guilds/:guildId/settings', isAuthenticated, async (req, res) => {
  try {
    const { prefix, language, mcIp } = req.body;
    await GuildSettings.findOneAndUpdate(
      { guildId: req.params.guildId },
      { prefix, language, mcIp },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
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
app.get('/intelligence', isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'intelligence.html')));
app.get('/onboarding', isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'intelligence.html')));

// Dynamic Server Pages
const serverPages = ['overview', 'settings', 'moderation', 'roles', 'logs', 'modules', 'welcome', 'premium', 'configuration', 'ticket', 'bugs', 'intelligence'];
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

// ── Platform activation and intelligence ───────────────────────────────
app.get('/api/guilds/:guildId/activation', isAuthenticated, requireGuildManager, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const botConnected = !!client.guilds.cache.get(guildId);
    const plugin = await PluginInstance.findOne({ serverId: guildId }).sort({ lastSeenAt: -1 }).lean();
    const telemetry24h = await TelemetryEvent.countDocuments({ serverId: guildId, occurredAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    const telemetryActive = telemetry24h > 0;
    const intelligenceActive = telemetry24h >= 10;
    const steps = [
      { key: 'bot_added', label: 'Bot added', complete: botConnected, percent: 0 },
      { key: 'discord_connected', label: 'Discord connected', complete: !!req.user, percent: 25 },
      { key: 'minecraft_connected', label: 'Minecraft connected', complete: !!plugin, percent: 50 },
      { key: 'data_collection_active', label: 'Data collection active', complete: telemetryActive, percent: 75 },
      { key: 'server_intelligence_active', label: 'Server intelligence active', complete: intelligenceActive, percent: 100 },
    ];
    const completed = steps.filter(step => step.complete).length;
    const progress = intelligenceActive ? 100 : telemetryActive ? 75 : plugin ? 50 : botConnected ? 25 : 0;
    res.json({ success: true, progress, completed, steps, evidence: { telemetry24h, lastPluginSeenAt: plugin?.lastSeenAt || null, instanceId: plugin?.instanceId || null }, nextValue: progress < 100 ? 'Connect the next incomplete system to unlock evidence-backed server intelligence.' : 'Server intelligence is active.' });
  } catch (error) { res.status(500).json({ success: false, error: 'activation_status_failed' }); }
});

app.get('/api/guilds/:guildId/intelligence', isAuthenticated, requireGuildManager, async (req, res) => {
  try {
    const events = await TelemetryEvent.find({ serverId: req.params.guildId, occurredAt: { $gte: new Date(Date.now() - WINDOW_MS * 2), $lt: new Date() } }).sort({ occurredAt: -1 }).limit(10000).lean();
    res.json({ success: true, intelligence: summarizeTelemetry(events) });
  } catch (error) { res.status(500).json({ success: false, error: 'intelligence_failed' }); }
});

// ── Secure plugin provisioning and health ───────────────────────────────
app.post('/api/guilds/:guildId/plugin/provision', isAuthenticated, requireGuildManager, async (req, res) => {
  try {
    if (!process.env.PLUGIN_ENCRYPTION_KEY) return res.status(503).json({ success: false, error: 'plugin_provisioning_not_configured' });
    const instanceId = String(req.body?.instanceId || '').trim().slice(0, 64);
    if (!/^[A-Za-z0-9._-]{3,64}$/.test(instanceId)) return res.status(400).json({ success: false, error: 'invalid_instance_id' });
    const accessToken = `pmc_${crypto.randomBytes(32).toString('base64url')}`;
    const signingSecret = crypto.randomBytes(32).toString('base64url');
    await PluginCredential.findOneAndUpdate({ serverId: req.params.guildId, instanceId }, { serverId: req.params.guildId, instanceId, accessTokenHash: hashToken(accessToken), encryptedSigningSecret: encryptSecret(signingSecret), protocolVersion: '1', revokedAt: null, lastRotatedAt: new Date() }, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.status(201).json({ success: true, oneTimeConfig: { baseUrl: `${req.protocol}://${req.get('host')}`, serverId: req.params.guildId, instanceId, accessToken, signingSecret, protocolVersion: '1' }, warning: 'Store these credentials in the plugin config.yml. They are not returned again.' });
  } catch (error) { console.error('[plugin provision] error:', error.message); res.status(500).json({ success: false, error: 'plugin_provision_failed' }); }
});

app.delete('/api/guilds/:guildId/plugin/:instanceId', isAuthenticated, requireGuildManager, async (req, res) => {
  const instanceId = String(req.params.instanceId || '').slice(0, 64);
  const result = await PluginCredential.updateOne({ serverId: req.params.guildId, instanceId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  await PluginInstance.updateOne({ serverId: req.params.guildId, instanceId }, { $set: { status: 'offline', revokedAt: new Date() } });
  res.json({ success: true, revoked: result.modifiedCount > 0 });
});

app.get('/api/guilds/:guildId/plugin/instances', isAuthenticated, requireGuildManager, async (req, res) => {
  const instances = await PluginInstance.find({ serverId: req.params.guildId }).sort({ lastSeenAt: -1 }).lean();
  res.json({ success: true, instances });
});

app.get('/api/observability', isAuthenticated, async (req, res) => {
  try {
    const isOwner = String(process.env.OWNER_ID || '').split(',').includes(req.user?.id);
    if (!isOwner) return res.status(403).json({ success: false, error: 'owner_required' });
    res.json({ success: true, service: 'promcbot', uptimeSeconds: Math.floor(process.uptime()), mongoReadyState: mongoose.connection.readyState, telemetry24h: await TelemetryEvent.countDocuments({ receivedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }), pluginInstances: await PluginInstance.countDocuments({ revokedAt: null }), automationRules: await AutomationRule.countDocuments({ enabled: true }), timestamp: new Date().toISOString() });
  } catch (error) { res.status(500).json({ success: false, error: 'observability_failed' }); }
});

app.post('/api/guilds/:guildId/automation', isAuthenticated, requireGuildManager, async (req, res) => {
  try {
    const body = req.body || {};
    const rule = await AutomationRule.create({ serverId: req.params.guildId, name: String(body.name || 'Activity decline alert').slice(0, 120), enabled: body.enabled !== false, trigger: body.trigger === 'weekly_summary' ? 'weekly_summary' : 'activity_decline', thresholdPercent: Number.isFinite(Number(body.thresholdPercent)) ? Number(body.thresholdPercent) : -5, action: 'discord_message', channelId: String(body.channelId || '').slice(0, 32), messageTemplate: String(body.messageTemplate || 'ProMcBot detected a measured activity decline: {{activityChange}}.').slice(0, 1500), cooldownMinutes: Math.min(43200, Math.max(60, Number(body.cooldownMinutes) || 1440)), createdBy: req.user.id });
    res.status(201).json({ success: true, rule });
  } catch (error) { res.status(400).json({ success: false, error: 'automation_rule_invalid' }); }
});

app.get('/api/guilds/:guildId/automation', isAuthenticated, requireGuildManager, async (req, res) => {
  const [rules, executions] = await Promise.all([AutomationRule.find({ serverId: req.params.guildId }).sort({ createdAt: -1 }).lean(), AutomationExecution.find({ serverId: req.params.guildId }).sort({ executedAt: -1 }).limit(50).lean()]);
  res.json({ success: true, rules, executions });
});

app.patch('/api/guilds/:guildId/automation/:ruleId', isAuthenticated, requireGuildManager, async (req, res) => {
  const rule = await AutomationRule.findOneAndUpdate({ _id: req.params.ruleId, serverId: req.params.guildId }, { $set: { ...(typeof req.body?.enabled === 'boolean' ? { enabled: req.body.enabled } : {}), ...(req.body?.name ? { name: String(req.body.name).slice(0, 120) } : {}) } }, { new: true }).lean();
  if (!rule) return res.status(404).json({ success: false, error: 'rule_not_found' });
  res.json({ success: true, rule });
});

app.delete('/api/guilds/:guildId/automation/:ruleId', isAuthenticated, requireGuildManager, async (req, res) => {
  const deleted = await AutomationRule.findOneAndDelete({ _id: req.params.ruleId, serverId: req.params.guildId });
  res.json({ success: true, deleted: !!deleted });
});

const automationInterval = setInterval(() => {
  if (mongoose.connection.readyState === 1) runEnabledRules(client).catch(error => console.error('[automation] cycle failed:', error.message));
}, 5 * 60 * 1000);
if (typeof automationInterval.unref === 'function') automationInterval.unref();

// 404 Handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(dashDir, '404', '404.html'));
});

module.exports = { app };
