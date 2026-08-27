// dash/index.js — Full Dashboard Backend
// Handles all web routes, Discord OAuth, and page serving

// Load env in dev
if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv-flow').config(); } catch (e) {}
}

const express    = require('express');
const passport   = require('passport');
const mongoose   = require('mongoose');
const path       = require('path');
const fs         = require('fs');
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
const { analyzePlayers } = require('../bot/utils/playerIntelligenceEngine');
const { summarizeNetwork } = require('../bot/utils/networkIntelligenceEngine');
const { interpretEvidence, available: aiAvailable } = require('../bot/utils/aiInterpretationEngine');
const { runEnabledRules } = require('../bot/utils/automationEngine');
const { PLANS, getPlan, getEntitlement, hasFeature, PLAN_ORDER } = require('../bot/utils/entitlements');
const Subscription = require('../bot/Models/Subscription');
const Payment = require('../bot/Models/Payment');
const Invoice = require('../bot/Models/Invoice');
const BillingEvent = require('../bot/Models/BillingEvent');
const Report = require('../bot/Models/Report');
const Notification = require('../bot/Models/Notification');
const SecurityEvent = require('../bot/Models/SecurityEvent');
const AuditLog = require('../bot/Models/AuditLog');
const { getForGuild, ensureFreeSubscription, consumeUsage } = require('../bot/utils/entitlementService');
const { verifyPayPalWebhook, providerConfigured, processVerifiedEvent, getPaymentCatalog, getPublicPlans, inspectPayPalConfiguration, createCheckout, cancelSubscription, formatPayPalError, getPayPalErrorDetails } = require('../bot/utils/billingService');
const { generateWeeklyReport } = require('../bot/utils/weeklyReportEngine');
const { listNotifications, markRead, resolveNotification } = require('../bot/utils/notificationService');
const { recordSecurityEvent } = require('../bot/utils/securityEventService');
const { recordAudit } = require('../bot/utils/auditLogService');
const { latestOnlinePlayers } = require('../bot/utils/telemetryProjection');
const { getWorkspaceGuilds, resolveWorkspaceGuildReference } = require('./guildAccess');
const { botAccessDecision, botAccessPayload, buildBotInviteUrl, getBotMembership, resolveBotMembership } = require('./botAccess');
const { getGuildVisual } = require('./serverVisuals');
const { buildServerInfoUpdate, normalizeMinecraftSettings } = require('./settingsValidation');
const { getConfigurationStatus } = require('./configurationStatus');
const { DEFAULT_AUTOMOD, normalizeAutomod } = require('./moderationConfig');
const { buildPublicStats } = require('./publicStats');

// ── Models ──────────────────────────────────────────────────────
const ServerInfo     = require('../bot/Models/Server');
const GuildSettings  = require('../bot/Models/GuildSettings');
const BotConfig       = require('../bot/Models/BotConfig');
const UserProfile      = require('../bot/Models/UserProfile');

// ── Express App ──────────────────────────────────────────────────
const app = express();

app.use(cors());
app.use(express.json({
  limit: '512kb',
  verify: (req, res, buffer) => {
    if (req.path === '/api/v1/telemetry/events' || req.path === '/api/v1/plugin/capabilities' || req.path.startsWith('/api/billing/webhook/')) req.rawBody = Buffer.from(buffer);
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

const requireDatabaseReady = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ success: false, error: 'database_unavailable', message: 'MongoDB is not connected; this data-backed operation is temporarily unavailable.' });
  next();
};

app.use((req, res, next) => {
  // Database initialization runs once in the background. Do not block static pages,
  // auth checks, or server context while MongoDB is connecting or unavailable.
  void dbInit;
  next();
});

// Provider webhooks are verified from the exact raw body before changing subscription state.
app.post('/api/billing/webhook/:provider', rateLimit({ windowMs: 60 * 1000, max: 60 }), async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  if (provider !== 'paypal') return res.status(501).json({ success: false, error: 'billing_provider_not_implemented' });
  if (!providerConfigured(provider)) return res.status(503).json({ success: false, error: 'billing_provider_not_configured' });
  try {
    const verification = await verifyPayPalWebhook(req.rawBody, {
      'paypal-transmission-time': req.get('paypal-transmission-time'),
      'paypal-transmission-id': req.get('paypal-transmission-id'),
      'paypal-transmission-sig': req.get('paypal-transmission-sig'),
      'paypal-cert-url': req.get('paypal-cert-url'),
      'paypal-auth-algo': req.get('paypal-auth-algo'),
    });
    if (!verification.valid) return res.status(400).json({ success: false, error: verification.reason });
    const result = await processVerifiedEvent(provider, req.body);
    res.status(200).json({ received: true, ...result });
  } catch (error) {
    await BillingEvent.updateOne({ provider, eventId: req.body?.id }, { $set: { status: 'failed', error: String(error.message).slice(0, 500) } }).catch(() => null);
    console.error('[billing webhook] error:', error.message);
    res.status(400).json({ success: false, error: 'billing_event_rejected' });
  }
});

// First-party Minecraft plugin telemetry. Signature verification uses the exact raw body.
app.get('/api/v1/plugin/capabilities', rateLimit({ windowMs: 60 * 1000, max: 120 }), async (req, res) => {
  try {
    const auth = await authenticatePluginRequest(req, req.rawBody || Buffer.from(''));
    if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error });
    const entitlement = await getForGuild(auth.serverId);
    const body = JSON.stringify({ success: true, protocolVersion: auth.protocolVersion, serverId: auth.serverId, instanceId: auth.instanceId, plan: entitlement.plan, features: entitlement.features, limits: entitlement.limits, expiresAt: entitlement.currentPeriodEnd || null });
    const response = res.status(200).json(JSON.parse(body));
    void response;
  } catch (error) { console.error('[plugin capabilities] error:', error.message); res.status(500).json({ success: false, error: 'capabilities_failed' }); }
});

app.post('/api/v1/telemetry/events', rateLimit({ windowMs: 60 * 1000, max: 120 }), async (req, res) => {
  try {
    const auth = await authenticatePluginRequest(req, req.rawBody || Buffer.from(''));
    if (!auth.ok) {
      if (['invalid_signature', 'replayed_request', 'plugin_not_provisioned'].includes(auth.error)) await recordSecurityEvent({ guildId: req.get('x-promcbot-server') || 'unknown', instanceId: req.get('x-promcbot-instance') || null, event: auth.error, severity: auth.error === 'invalid_signature' ? 'high' : 'medium', evidence: { source: 'plugin_protocol', timestamp: req.get('x-promcbot-timestamp') || null }, action: 'review_or_revoke' }).catch(() => null);
      return res.status(auth.status).json({ success: false, error: auth.error });
    }
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
    const latestCount = latestOnlinePlayers(documents);
    const headerValue = name => String(req.get(name) || '').trim().slice(0, 120) || null;
    await PluginInstance.findOneAndUpdate({ serverId: auth.serverId, instanceId: auth.instanceId }, { $set: { protocolVersion: auth.protocolVersion, lastSeenAt: new Date(), status: 'online', ...(latestCount === null ? {} : { lastOnlinePlayers: latestCount }), ...(headerValue('x-promcbot-network') ? { networkId: headerValue('x-promcbot-network') } : {}), ...(headerValue('x-promcbot-minecraft-server') ? { minecraftServerId: headerValue('x-promcbot-minecraft-server') } : {}), ...(headerValue('x-promcbot-server-name') ? { serverName: headerValue('x-promcbot-server-name') } : {}) }, $setOnInsert: { firstSeenAt: new Date() } }, { upsert: true });
    res.status(202).json({ success: true, accepted: documents.length, serverId: auth.serverId, instanceId: auth.instanceId });
  } catch (error) {
    if (error?.code === 11000) return res.status(202).json({ success: true, accepted: 0, duplicate: true });
    if (error?.message === 'invalid_occurredAt') return res.status(400).json({ success: false, error: error.message });
    console.error('[plugin telemetry] error:', error.message);
    res.status(500).json({ success: false, error: 'telemetry_ingest_failed' });
  }
});

// ── Session ───────────────────────────────────────────────────────
const sessionMongoUrl = String(process.env.MONGO_URL || process.env.MONGO_URI || '').trim();
const sessionStore = sessionMongoUrl
  ? MongoStore.create({ mongoUrl: sessionMongoUrl, collectionName: 'sessions', ttl: 7 * 24 * 60 * 60 })
  : null;
if (!sessionStore) {
  console.warn('⚠️ MONGO_URL is not configured; dashboard sessions use non-persistent memory storage until MongoDB is configured.');
}
const sessionOptions = {
  secret: process.env.SESSION_SECRET || nanoid(48),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
};
if (sessionStore) sessionOptions.store = sessionStore;
app.use(session(sessionOptions));

app.use(passport.initialize());
app.use(passport.session());

// The dashboard uses the single Discord client created by bot/index.js.
// `global.__botClient` is assigned during bot startup; resolving it lazily
// prevents dashboard module load order from creating a second login session.
const getBotClient = () => global.__botClient || null;

// ── Passport / Discord OAuth ────────────────────────────────────────
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const discordOAuthConfigured = Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET);
if (!discordOAuthConfigured) console.warn('⚠️ Discord OAuth credentials are not configured; dashboard login is unavailable.');
const CALLBACK_URL = process.env.CALLBACK_URL || "https://promcbot.dev/auth/discord/callback";

if (discordOAuthConfigured) {
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
}

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

async function requireGuildManager(req, res, next) {
  const reference = req.params.guildId;
  const guild = resolveWorkspaceGuildReference(req.user, reference);
  if (!guild) {
    if (req.path.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) return res.status(403).json({ success: false, error: 'guild_access_required' });
    return res.redirect(302, '/myservers?guild_access_required=1');
  }
  const membership = await resolveBotMembership(getBotClient(), guild.id);
  const inviteUrl = buildBotInviteUrl(DISCORD_CLIENT_ID);
  req.managedGuild = guild;
  req.botMembership = membership;
  req.botInviteUrl = inviteUrl;
  req.params.guildId = guild.id;
  const decision = botAccessDecision(membership);
  if (!decision.allow) {
    const error = decision.error;
    const message = membership.state === 'absent' ? 'Invite ProMcBot to this Discord server before opening its workspace.' : 'Discord bot membership is still loading; retry shortly.';
    if (req.path.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) return res.status(decision.status).json({ success: false, error, message, inviteUrl });
    return res.redirect(302, `/myservers?${error}=1&guildId=${encodeURIComponent(guild.id)}`);
  }
  next();
}

// ── Static Files ─────────────────────────────────────────────────────
const dashDir = path.join(__dirname, 'dashboard');
app.use('/dashboard', express.static(dashDir));
app.use('/public', express.static(path.join(__dirname, '..', 'bot', 'public')));

// ── Routes ───────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(dashDir, 'home.html')));
app.get('/loading-auth', (req, res) => res.sendFile(path.join(dashDir, 'Loading', 'loading.html')));

app.get('/auth/discord', (req, res, next) => {
  if (!discordOAuthConfigured) return res.status(503).send('Discord login is not configured.');
  return passport.authenticate('discord')(req, res, next);
});
app.get('/auth/discord/callback', (req, res, next) => {
  if (!discordOAuthConfigured) return res.status(503).send('Discord login is not configured.');
  return passport.authenticate('discord', { failureRedirect: '/' })(req, res, next);
}, (req, res) => {
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
    const guildIds = (req.user.guilds || []).map(guild => guild.id).filter(Boolean);
    const subscriptions = guildIds.length ? await Subscription.find({ guildId: { $in: guildIds } }).lean() : [];
    const entitlements = subscriptions.map(subscription => getEntitlement(subscription));
    const best = entitlements.sort((a, b) => PLAN_ORDER.indexOf(b.plan) - PLAN_ORDER.indexOf(a.plan))[0] || getEntitlement(null);
    res.json({ success: true, membership: { plan: best.plan, status: best.status, source: 'subscription_authority' } });
  } catch (e) { res.json({ success: true, membership: { plan: 'free', status: 'active', source: 'subscription_authority' } }); }
});

app.get('/api/guilds/:guildId/entitlements', isAuthenticated, requireGuildManager, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ success: false, error: 'database_unavailable', message: 'MongoDB is not connected; entitlement data is temporarily unavailable.' });
  try {
    await ensureFreeSubscription(req.params.guildId);
    const entitlement = await getForGuild(req.params.guildId);
    res.json({ success: true, entitlement, availablePlans: Object.values(PLANS), authority: 'server_subscription' });
  } catch (_) {
    res.status(503).json({ success: false, error: 'entitlements_unavailable', message: 'Entitlement data is temporarily unavailable.' });
  }
});

app.get('/api/guilds/:guildId/usage', isAuthenticated, requireGuildManager, requireDatabaseReady, async (req, res) => {
  const entitlement = await getForGuild(req.params.guildId);
  const period = new Date().toISOString().slice(0, 7);
  const usage = await require('../bot/Models/UsageCounter').find({ guildId: req.params.guildId, period }).lean();
  const byFeature = Object.fromEntries(usage.map(item => [item.feature, { used: item.used, limit: entitlement.limits?.[item.feature] ?? null }]));
  res.json({ success: true, period, plan: entitlement.plan, limits: entitlement.limits, usage: byFeature });
});

app.get('/api/billing/config', isAuthenticated, (req, res) => {
  const catalog = getPaymentCatalog();
  res.json({ success: true, plans: getPublicPlans(), provider: catalog.provider, environment: catalog.environment, configured: catalog.configured, methods: catalog.methods, webhookUrl: '/api/billing/webhook/paypal' });
});

app.get('/api/billing/diagnostics', isAuthenticated, async (req, res) => {
  try {
    res.json({ success: true, diagnostics: await inspectPayPalConfiguration() });
  } catch (error) {
    console.error('[billing diagnostics] error:', error.message);
    res.status(502).json({ success: false, error: 'billing_diagnostics_failed', message: 'تعذر فحص PayPal الآن. حاول مرة أخرى.' });
  }
});

app.get('/api/configuration/status', isAuthenticated, (req, res) => {
  res.json({ success: true, status: getConfigurationStatus(), source: 'deployment_configuration_presence_only' });
});

app.get('/api/guilds/:guildId/billing', isAuthenticated, requireGuildManager, requireDatabaseReady, async (req, res) => {
  const [entitlement, subscription, invoices, payments] = await Promise.all([getForGuild(req.params.guildId), Subscription.findOne({ guildId: req.params.guildId }).lean(), Invoice.find({ guildId: req.params.guildId }).sort({ issuedAt: -1 }).limit(50).lean(), Payment.find({ guildId: req.params.guildId }).sort({ createdAt: -1 }).limit(50).lean()]);
  res.json({ success: true, entitlement, subscription: subscription || { guildId: req.params.guildId, plan: 'free', status: 'active', provider: 'none', renewalState: 'not_applicable' }, invoices, payments, provider: getPaymentCatalog() });
});

app.post('/api/guilds/:guildId/billing/checkout', isAuthenticated, requireGuildManager, requireDatabaseReady, async (req, res) => {
  const plan = String(req.body?.plan || '').toLowerCase();
  const method = String(req.body?.method || 'paypal').toLowerCase();
  if (!['pro', 'ultimate'].includes(plan)) return res.status(400).json({ success: false, error: 'invalid_paid_plan' });
  try {
    const baseUrl = String(process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const serverPremiumPath = `/myservers/${encodeURIComponent(req.params.guildId)}/premium`;
    const checkout = await createCheckout({ guildId: req.params.guildId, plan, method, returnUrl: `${baseUrl}${serverPremiumPath}?billing=pending`, cancelUrl: `${baseUrl}${serverPremiumPath}?billing=cancelled` });
    try {
      await recordAudit({ actorId: req.user.id, guildId: req.params.guildId, action: 'billing_checkout_created', feature: `billing.${plan}`, result: 'pending_provider_approval', source: `paypal:${method}`, target: checkout.providerSubscriptionId });
    } catch (auditError) {
      console.error('[billing checkout] audit write failed after provider checkout:', auditError.message);
    }
    res.json({ success: true, ...checkout });
  } catch (error) {
    const configurationError = ['payment_method_not_configured', 'payment_plan_not_configured', 'paypal_credentials_missing', 'paypal_approval_url_missing'].includes(error.message);
    const providerMessage = formatPayPalError(error);
    const providerDetails = getPayPalErrorDetails(error);
    console.error('[billing checkout] provider error:', error.message, providerDetails.debugId ? `debug=${providerDetails.debugId}` : '');
    res.status(configurationError ? 503 : 502).json({ success: false, error: configurationError ? 'billing_provider_not_configured' : 'billing_checkout_failed', message: providerMessage, method, ...(providerDetails.debugId ? { debugId: providerDetails.debugId } : {}) });
  }
});

app.post('/api/guilds/:guildId/billing/cancel', isAuthenticated, requireGuildManager, requireDatabaseReady, async (req, res) => {
  const subscription = await Subscription.findOne({ guildId: req.params.guildId }).lean();
  if (!subscription?.providerSubscriptionId) return res.status(409).json({ success: false, error: 'no_provider_subscription' });
  if (subscription.provider !== 'paypal' || !providerConfigured('paypal')) return res.status(503).json({ success: false, error: 'billing_provider_not_configured' });
  try {
    const result = await cancelSubscription(subscription.providerSubscriptionId);
    await Subscription.updateOne({ guildId: req.params.guildId }, { $set: { renewalState: 'will_cancel', cancellationAt: new Date() } });
    try {
      await recordAudit({ actorId: req.user.id, guildId: req.params.guildId, action: 'billing_cancel_requested', feature: 'billing.subscription', result: 'success', source: 'paypal', target: subscription.providerSubscriptionId });
    } catch (auditError) {
      console.error('[billing cancel] audit write failed after provider cancellation:', auditError.message);
    }
    res.json({ success: true, ...result });
  } catch (error) {
    const details = getPayPalErrorDetails(error);
    const message = formatPayPalError(error);
    console.error('[billing cancel] provider error:', error.message, details.debugId ? `debug=${details.debugId}` : '');
    res.status(502).json({ success: false, error: 'billing_cancel_failed', message, ...(details.debugId ? { debugId: details.debugId } : {}) });
  }
});

// ── Guild API ─────────────────────────────────────────────────────
app.get('/api/guilds', isAuthenticated, async (req, res) => {
  const botClient = getBotClient();
  const inviteUrl = buildBotInviteUrl(DISCORD_CLIENT_ID);
  const guilds = await Promise.all(getWorkspaceGuilds(req.user).map(async guild => ({
    ...guild,
    ...botAccessPayload(guild, await resolveBotMembership(botClient, guild.id), inviteUrl),
  })));
  res.json({ success: true, guilds, count: guilds.length, scope: 'owner_or_administrator_only' });
});

app.get('/api/guilds/:guildId/visual', isAuthenticated, requireGuildManager, async (req, res) => {
  try {
    let botGuild = req.botMembership?.guild || getBotClient()?.guilds?.cache?.get(req.params.guildId) || null;
    if (botGuild?.fetch) {
      try { botGuild = await botGuild.fetch(); } catch (_) { /* cached Discord data remains a safe fallback */ }
    }
    const sourceGuild = { ...(req.managedGuild || {}), banner: botGuild?.banner || req.managedGuild?.banner || null, icon: botGuild?.icon || req.managedGuild?.icon || null };
    const visual = await getGuildVisual(sourceGuild);
    res.json({ success: true, guildId: req.params.guildId, visual });
  } catch (_) {
    res.status(200).json({ success: true, guildId: req.params.guildId, visual: { bannerUrl: null, iconUrl: null, dominantColor: '#5865f2', source: 'default' } });
  }
});

app.get('/api/guilds/:guildId/settings', isAuthenticated, requireGuildManager, async (req, res) => {
  try {
    const [storedSettings, serverInfo] = await Promise.all([
      GuildSettings.findOne({ guildId: req.params.guildId }).lean(),
      ServerInfo.findOne({ serverId: req.params.guildId }).lean(),
    ]);
    const settings = { prefix: '!', language: 'en', ...(storedSettings || {}), mcIp: storedSettings?.mcIp || serverInfo?.javaIP || '', mcPort: serverInfo?.javaPort || 25565 };
    res.json({ success: true, settings });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/guilds/:guildId/settings', isAuthenticated, requireGuildManager, async (req, res) => {
  try {
    const normalized = normalizeMinecraftSettings(req.body);
    if (!normalized.ok) return res.status(400).json({ success: false, error: normalized.error });
    const { prefix, language, mcIp, mcPort: rawPort } = normalized.settings;
    const serverUpdate = buildServerInfoUpdate({ mcIp, mcPort: rawPort });
    await Promise.all([
      GuildSettings.findOneAndUpdate(
        { guildId: req.params.guildId },
        { $set: { prefix, language, mcIp } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ),
      ServerInfo.findOneAndUpdate(
        { serverId: req.params.guildId },
        serverUpdate,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ),
    ]);
    res.json({ success: true, settings: { prefix, language, mcIp, mcPort: rawPort } });
  } catch (e) {
    res.status(500).json({ success: false, error: 'settings_save_failed' });
  }
});

const moduleKeys = ['autoResponder', 'welcomeMessages', 'moderation', 'logs', 'tickets', 'serverStatus'];
const moduleMeta = {
  autoResponder: { label: 'Auto responder', description: 'Reply to configured phrases.', href: 'configuration' },
  welcomeMessages: { label: 'Welcome messages', description: 'Greet new members in a chosen channel.', href: 'welcome' },
  moderation: { label: 'Moderation', description: 'Apply the server moderation module.', href: 'moderation', requiredFeature: 'moderation.advanced' },
  logs: { label: 'Audit logging', description: 'Keep administrative activity visible.', href: 'logs' },
  tickets: { label: 'Support tickets', description: 'Give members a support entry point.', href: 'ticket' },
  serverStatus: { label: 'Server status', description: 'Show Minecraft health and status signals.', href: 'intelligence' },
};

app.get('/api/guilds/:guildId/moderation', isAuthenticated, requireGuildManager, requireDatabaseReady, async (req, res) => {
  try {
    const entitlement = await getForGuild(req.params.guildId);
    if (!hasFeature(entitlement, 'moderation.advanced')) return res.status(402).json({ success: false, error: 'feature_requires_pro', feature: 'moderation.advanced', requiredPlan: 'pro', message: 'Moderation requires the Pro plan.' });
    const settings = await GuildSettings.findOne({ guildId: req.params.guildId }).lean();
    const guild = getBotClient()?.guilds?.cache?.get(req.params.guildId);
    const channels = guild?.channels?.cache ? [...guild.channels.cache.values()].filter(channel => {
      const textBased = typeof channel.isTextBased === 'function' ? channel.isTextBased() : [0, 5].includes(channel.type);
      return textBased && channel.name;
    }).map(channel => ({ id: channel.id, name: channel.name })).sort((a, b) => a.name.localeCompare(b.name)) : [];
    res.json({ success: true, guildId: req.params.guildId, automod: normalizeAutomod(settings?.automod), channels, entitlement: { plan: entitlement.plan } });
  } catch (error) { res.status(500).json({ success: false, error: 'moderation_unavailable' }); }
});

app.patch('/api/guilds/:guildId/moderation', isAuthenticated, requireGuildManager, requireDatabaseReady, async (req, res) => {
  const entitlement = await getForGuild(req.params.guildId);
  if (!hasFeature(entitlement, 'moderation.advanced')) return res.status(402).json({ success: false, error: 'feature_requires_pro', feature: 'moderation.advanced', requiredPlan: 'pro', message: 'Moderation requires the Pro plan.' });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const current = normalizeAutomod(body);
  try {
    await GuildSettings.findOneAndUpdate({ guildId: req.params.guildId }, { $set: { automod: current } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    await BotConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: { 'modules.moderation': current.enabled } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ success: true, guildId: req.params.guildId, automod: current });
  } catch (error) { res.status(500).json({ success: false, error: 'moderation_update_failed' }); }
});

app.get('/api/guilds/:guildId/overview', isAuthenticated, requireGuildManager, requireDatabaseReady, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const now = Date.now();
    const botGuild = getBotClient()?.guilds?.cache?.get(guildId) || null;
    const [plugin, telemetry24h, settings, entitlement, botConfig, serverInfo] = await Promise.all([
      PluginInstance.findOne({ serverId: guildId }).sort({ lastSeenAt: -1 }).lean(),
      TelemetryEvent.countDocuments({ serverId: guildId, occurredAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } }),
      GuildSettings.findOne({ guildId }).lean(),
      getForGuild(guildId),
      BotConfig.findOne({ guildId }).lean(),
      ServerInfo.findOne({ serverId: guildId }).lean(),
    ]);
    const pluginOnline = Boolean(plugin && (plugin.status === 'online' || (plugin.lastSeenAt && new Date(plugin.lastSeenAt).getTime() >= now - 15 * 60 * 1000)));
    res.json({ success: true, source: 'discord+plugin+telemetry+entitlement', server: { id: guildId, name: botGuild?.name || plugin?.serverName || null, icon: botGuild?.icon || null, memberCount: Number.isFinite(botGuild?.memberCount) ? botGuild.memberCount : null, discordConnected: Boolean(botGuild) }, plugin: plugin ? { instanceId: plugin.instanceId, status: pluginOnline ? 'online' : plugin.status || 'offline', lastSeenAt: plugin.lastSeenAt || null, onlinePlayers: plugin.lastOnlinePlayers ?? null } : null, telemetry: { events24h: telemetry24h }, entitlement: { plan: entitlement.plan, name: entitlement.name, status: entitlement.status, currentPeriodEnd: entitlement.currentPeriodEnd || null }, settings: { prefix: settings?.prefix || '!', language: settings?.language || 'en', mcIp: settings?.mcIp || null, mcPort: serverInfo?.javaPort || 25565 }, modules: botConfig?.modules || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: 'overview_unavailable' });
  }
});

app.get('/api/guilds/:guildId/modules', isAuthenticated, requireGuildManager, requireDatabaseReady, async (req, res) => {
  try {
    const [config, pluginInstances, settings] = await Promise.all([
      BotConfig.findOne({ guildId: req.params.guildId }).lean(),
      PluginInstance.find({ serverId: req.params.guildId }).sort({ lastSeenAt: -1 }).limit(20).lean(),
      GuildSettings.findOne({ guildId: req.params.guildId }).lean(),
    ]);
    const configuredModules = config?.modules || {};
    const moduleEnabled = id => id === 'moderation' ? (configuredModules[id] === true || settings?.automod?.enabled === true) : configuredModules[id] === true;
    const moduleToggleable = id => id === 'autoResponder' || id === 'moderation' || id === 'logs';
    const entitlement = await getForGuild(req.params.guildId);
    const modules = moduleKeys.map(id => {
      const meta = moduleMeta[id];
      const locked = Boolean(meta.requiredFeature && !hasFeature(entitlement, meta.requiredFeature));
      return {
        id,
        ...meta,
        enabled: moduleEnabled(id),
        configured: Boolean(config),
        locked,
        requiredPlan: meta.requiredFeature ? require('../bot/utils/entitlements').requiredPlanFor(meta.requiredFeature) : null,
        lockReason: locked ? `Requires ${String(require('../bot/utils/entitlements').requiredPlanFor(meta.requiredFeature) || 'paid').toUpperCase()} plan.` : null,
        statusLabel: locked ? 'Locked' : moduleToggleable(id) ? (moduleEnabled(id) ? 'Enabled' : 'Off') : (moduleEnabled(id) ? 'Configured' : 'Open setup'),
        href: `/myservers/${encodeURIComponent(req.params.guildId)}/${meta.href}`,
        toggleable: moduleToggleable(id) && !locked,
      };
    });
    const recentCutoff = Date.now() - 5 * 60 * 1000;
    const pluginOnline = pluginInstances.some(instance => instance.status === 'online' || (instance.lastSeenAt && new Date(instance.lastSeenAt).getTime() >= recentCutoff));
    modules.push({ id: 'minecraftPlugin', label: 'Minecraft plugin', description: 'Required for player data and remote server commands.', enabled: pluginOnline, configured: pluginInstances.length > 0, statusLabel: pluginOnline ? 'Connected' : pluginInstances.length ? 'Waiting for heartbeat' : 'Not connected', href: `/myservers/${encodeURIComponent(req.params.guildId)}/intelligence`, toggleable: false });
    res.json({ success: true, guildId: req.params.guildId, modules, source: 'BotConfig+PluginInstance' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'modules_unavailable' });
  }
});

app.patch('/api/guilds/:guildId/modules/:moduleId', isAuthenticated, requireGuildManager, requireDatabaseReady, async (req, res) => {
  const moduleId = String(req.params.moduleId || '');
  if (!moduleKeys.includes(moduleId) || typeof req.body?.enabled !== 'boolean') return res.status(400).json({ success: false, error: 'invalid_module_update' });
  const requiredFeature = moduleMeta[moduleId]?.requiredFeature;
  if (requiredFeature) {
    const entitlement = await getForGuild(req.params.guildId);
    if (!hasFeature(entitlement, requiredFeature)) return res.status(402).json({ success: false, error: 'feature_requires_pro', feature: requiredFeature, requiredPlan: 'pro', message: 'This module requires the Pro plan.' });
  }
  try {
    const config = await BotConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: { [`modules.${moduleId}`]: req.body.enabled } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    if (moduleId === 'moderation') await GuildSettings.findOneAndUpdate({ guildId: req.params.guildId }, { $set: { 'automod.enabled': req.body.enabled } }, { upsert: true, setDefaultsOnInsert: true });
    res.json({ success: true, moduleId, enabled: req.body.enabled });
  } catch (error) {
    res.status(500).json({ success: false, error: 'module_update_failed' });
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
      guilds: getWorkspaceGuilds(req.user)
    }
  });
});

// Public stats/profile experience. These endpoints intentionally expose aggregates only.
const publicStatsLimiter = rateLimit({ windowMs: 60 * 1000, max: 90, standardHeaders: true, legacyHeaders: false });
app.get('/api/public/stats/:guildId', publicStatsLimiter, requireDatabaseReady, async (req, res) => {
  const guildId = String(req.params.guildId || '');
  if (!/^\d{5,25}$/.test(guildId)) return res.status(400).json({ success: false, error: 'invalid_guild_id' });
  try {
    const botClient = getBotClient();
    const guild = botClient?.guilds?.cache?.get(guildId) || null;
    const [plugin, events] = await Promise.all([
      PluginInstance.findOne({ serverId: guildId }).sort({ lastSeenAt: -1 }).lean(),
      TelemetryEvent.find({ serverId: guildId, occurredAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000), $lt: new Date() }, type: { $in: ['heartbeat', 'player_count', 'player_join', 'player_leave'] } }).sort({ occurredAt: -1 }).limit(5000).lean(),
    ]);
    const stats = buildPublicStats(events, plugin);
    res.json({ success: true, server: { id: guildId, name: guild?.name || plugin?.serverName || 'Minecraft server', icon: guild?.icon || null }, stats, source: 'aggregate_telemetry' });
  } catch (error) {
    res.status(503).json({ success: false, error: 'public_stats_unavailable' });
  }
});

app.get('/api/public/profile/:identifier', publicStatsLimiter, async (req, res) => {
  const identifier = String(req.params.identifier || '').trim();
  if (!/^\d{5,25}$/.test(identifier) && !/^[A-Za-z0-9_.-]{2,32}$/.test(identifier)) return res.status(400).json({ success: false, error: 'invalid_public_profile_identifier' });
  try {
    const client = getBotClient();
    let user = null;
    if (/^\d{5,25}$/.test(identifier)) {
      user = await client?.users?.fetch(identifier);
    } else {
      const needle = identifier.toLowerCase();
      user = client?.users?.cache?.find(candidate => [candidate.username, candidate.globalName, candidate.tag].filter(Boolean).some(value => String(value).toLowerCase() === needle)) || null;
    }
    if (!user) return res.status(404).json({ success: false, error: 'public_profile_not_found', message: 'Public profile not found. Use a username already visible to the connected bot or the Discord user ID.' });
    let profileSettings = null;
    if (mongoose.connection.readyState === 1) profileSettings = await UserProfile.findOne({ userId: user.id }).lean();
    const customBanner = profileSettings?.bannerType === 'image' && profileSettings.banner ? profileSettings.banner : null;
    res.json({ success: true, profile: { id: user.id, username: user.username, globalName: user.globalName || user.username, avatar: user.displayAvatarURL({ extension: 'png', size: 256 }), banner: customBanner, accentColor: user.hexAccentColor || null, customStatus: profileSettings?.customStatus || '', bot: Boolean(user.bot), publicPath: `/user/${encodeURIComponent(user.username)}` }, privacy: { source: 'Discord public profile', privateGuildData: false, rawActivity: false } });
  } catch (error) {
    res.status(404).json({ success: false, error: 'public_profile_not_found' });
  }
});

app.get('/stats', (req, res) => res.sendFile(path.join(dashDir, 'pages', 'stats.html')));
app.get('/stats/:guildId', (req, res) => res.sendFile(path.join(dashDir, 'pages', 'stats.html')));
app.get('/profile/:identifier', (req, res) => res.sendFile(path.join(dashDir, 'pages', 'profile.html')));
app.get('/user/:username', (req, res) => res.sendFile(path.join(dashDir, 'pages', 'profile.html')));
app.get('/u/:identifier', (req, res) => res.redirect(302, `/profile/${encodeURIComponent(req.params.identifier)}`));

// Dashboard Protected Pages
app.get('/dashboard', isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'dashboard.html')));
app.get('/myservers', isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'servers.html')));
app.get('/servers', isAuthenticated, (req, res) => res.redirect(302, '/myservers'));
app.get('/intelligence', isAuthenticated, (req, res) => res.redirect(302, '/myservers'));
app.get('/onboarding', isAuthenticated, (req, res) => res.redirect(302, '/myservers'));
app.get('/actions', isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'actions.html')));
app.get('/premium', isAuthenticated, (req, res) => res.redirect(302, '/myservers'));

// Dynamic Server Pages
const serverPages = ['overview', 'settings', 'moderation', 'roles', 'logs', 'modules', 'welcome', 'premium', 'configuration', 'ticket', 'bugs', 'intelligence', 'actions'];
serverPages.forEach(page => {
  const serveServerPage = (req, res) => {
    const filePath = path.join(dashDir, 'pages', `${page}.html`);
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
    return res.status(404).sendFile(path.join(dashDir, '404', '404.html'));
  };
  app.get(`/myservers/:guildId/${page}`, isAuthenticated, requireGuildManager, serveServerPage);
  app.get(`/servers/:guildId/${page}`, isAuthenticated, requireGuildManager, (req, res) => res.redirect(302, `/myservers/${encodeURIComponent(req.params.guildId)}/${page}`));
});

// Shared Assets
app.get('/shared.css', (req, res) => res.sendFile(path.join(dashDir, 'shared.css')));
app.get('/shared.js', (req, res) => res.sendFile(path.join(dashDir, 'shared.js')));

// ── Platform activation and intelligence ───────────────────────────────
app.get('/api/guilds/:guildId/activation', isAuthenticated, requireGuildManager, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const botClient = getBotClient();
    const managedGuild = req.managedGuild || botClient?.guilds?.cache?.get(guildId) || null;
    const botConnected = req.botMembership?.state === 'installed';
    const now = Date.now();
    let plugin = null;
    let telemetry24h = 0;
    let playerEvents24h = 0;
    let telemetry14d = 0;
    const databaseReady = mongoose.connection.readyState === 1;
    if (databaseReady) {
      [plugin, telemetry24h, playerEvents24h, telemetry14d] = await Promise.all([
        PluginInstance.findOne({ serverId: guildId }).sort({ lastSeenAt: -1 }).lean(),
        TelemetryEvent.countDocuments({ serverId: guildId, occurredAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } }),
        TelemetryEvent.countDocuments({ serverId: guildId, type: { $in: ['player_join', 'player_leave'] }, occurredAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } }),
        TelemetryEvent.countDocuments({ serverId: guildId, occurredAt: { $gte: new Date(now - 14 * 24 * 60 * 60 * 1000) } }),
      ]);
    }
    const databaseNote = databaseReady ? '' : 'MongoDB is not connected; database-backed evidence is waiting and no metric is inferred.';
    const pluginHeartbeatRecent = Boolean(plugin?.lastSeenAt && new Date(plugin.lastSeenAt).getTime() >= now - 15 * 60 * 1000);
    // Heartbeat is a real telemetry event. Use it as the initial connection
    // evidence, while keeping player activity and intelligence thresholds strict.
    const telemetryActive = telemetry24h > 0 || pluginHeartbeatRecent;
    const comparisonWindowReady = telemetry14d >= 20;
    const intelligenceActive = telemetry24h >= 10 && comparisonWindowReady;
    const steps = [
      { key: 'account_authenticated', label: 'Dashboard account authenticated', complete: !!req.user, evidence: req.user ? 'Authenticated session is present.' : 'No authenticated session.' },
      { key: 'discord_runtime_connected', label: 'Discord runtime connected', complete: botConnected, evidence: botConnected ? 'Bot runtime can see this guild.' : 'Bot runtime cannot currently see this guild.' },
      { key: 'minecraft_plugin_provisioned', label: 'Minecraft plugin provisioned', complete: !!plugin, evidence: plugin?.instanceId ? `Instance ${plugin.instanceId} is registered.` : databaseNote || 'No registered plugin instance.' },
      { key: 'plugin_heartbeat_recent', label: 'Minecraft heartbeat is recent', complete: pluginHeartbeatRecent, evidence: plugin?.lastSeenAt ? `Last heartbeat: ${new Date(plugin.lastSeenAt).toISOString()}.` : databaseNote || 'No plugin heartbeat recorded.' },
      { key: 'telemetry_received', label: 'Telemetry received', complete: telemetryActive, evidence: databaseNote || (telemetry24h > 0 ? `${telemetry24h} telemetry event(s) recorded in the last 24 hours.` : pluginHeartbeatRecent ? 'A recent heartbeat was accepted; detailed player telemetry is still waiting.' : 'No telemetry event recorded in the last 24 hours.') },
      { key: 'player_activity_observed', label: 'Player activity observed', complete: playerEvents24h > 0, evidence: databaseNote || `${playerEvents24h} join/leave event(s) recorded in the last 24 hours.` },
      { key: 'comparison_window_ready', label: 'Comparison window ready', complete: comparisonWindowReady, evidence: databaseNote || `${telemetry14d} event(s) recorded in the last 14 days; at least 20 are required.` },
      { key: 'server_intelligence_active', label: 'Server intelligence active', complete: intelligenceActive, evidence: databaseNote || (intelligenceActive ? 'Both recent sample and comparison window thresholds are met.' : 'Recent and comparison-window thresholds are not both met.') },
    ];
    const completed = steps.filter(step => step.complete).length;
    const progress = Math.round((completed / steps.length) * 100);
    const nextStep = steps.find(step => !step.complete);
    res.json({ success: true, degraded: !databaseReady, progress, completed, steps, evidence: { telemetry24h, playerEvents24h, telemetry14d, lastPluginSeenAt: plugin?.lastSeenAt || null, instanceId: plugin?.instanceId || null }, server: { id: guildId, name: managedGuild?.name || plugin?.serverName || guildId, icon: managedGuild?.icon || null }, nextValue: nextStep ? `Next: ${nextStep.label}. ${nextStep.evidence}` : 'Server intelligence is active.' });
  } catch (error) { res.status(500).json({ success: false, error: 'activation_status_failed' }); }
});

app.get('/api/guilds/:guildId/players', isAuthenticated, requireGuildManager, async (req, res) => {
  try {
    const entitlement = await getForGuild(req.params.guildId);
    const events = await TelemetryEvent.find({ serverId: req.params.guildId, occurredAt: { $gte: new Date(Date.now() - entitlement.historyDays * 24 * 60 * 60 * 1000), $lt: new Date() }, type: { $in: ['player_join', 'player_leave'] } }).sort({ occurredAt: -1 }).limit(25000).lean();
    res.json({ success: true, entitlement: { plan: entitlement.plan, historyDays: entitlement.historyDays }, players: analyzePlayers(events), source: 'telemetry' });
  } catch (error) { res.status(500).json({ success: false, error: 'player_intelligence_failed' }); }
});

app.get('/api/guilds/:guildId/retention', isAuthenticated, requireGuildManager, async (req, res) => {
  const entitlement = await getForGuild(req.params.guildId);
  if (!hasFeature(entitlement, 'retention.advanced')) return res.status(402).json({ success: false, error: 'feature_requires_pro', feature: 'retention.advanced', requiredPlan: 'pro', message: 'Advanced retention analysis requires Pro. Basic player activity remains available.' });
  const events = await TelemetryEvent.find({ serverId: req.params.guildId, occurredAt: { $gte: new Date(Date.now() - entitlement.historyDays * 24 * 60 * 60 * 1000), $lt: new Date() }, type: { $in: ['player_join', 'player_leave'] } }).sort({ occurredAt: -1 }).limit(50000).lean();
  res.json({ success: true, retention: analyzePlayers(events).retention, journey: analyzePlayers(events).journey, sample: analyzePlayers(events).sample });
});

app.get('/api/guilds/:guildId/network', isAuthenticated, requireGuildManager, async (req, res) => {
  const entitlement = await getForGuild(req.params.guildId);
  if (!hasFeature(entitlement, 'network.intelligence')) return res.status(402).json({ success: false, error: 'feature_requires_ultimate', feature: 'network.intelligence', requiredPlan: 'ultimate', message: 'Network intelligence requires Ultimate. Server-level intelligence remains available.' });
  const networkId = String(req.query.networkId || '').trim().slice(0, 64) || null;
  const instanceQuery = { serverId: req.params.guildId, ...(networkId ? { networkId } : {}) };
  const instances = await PluginInstance.find(instanceQuery).lean();
  const instanceIds = instances.map(instance => instance.instanceId);
  const events = await TelemetryEvent.find({ serverId: req.params.guildId, ...(instanceIds.length ? { instanceId: { $in: instanceIds } } : { instanceId: '__none__' }), occurredAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), $lt: new Date() }, type: 'player_count' }).limit(50000).lean();
  res.json({ success: true, networkId, network: summarizeNetwork(instances, events), source: 'telemetry' });
});

app.get('/api/guilds/:guildId/security-events', isAuthenticated, requireGuildManager, async (req, res) => {
  const entitlement = await getForGuild(req.params.guildId);
  if (!hasFeature(entitlement, 'security.advanced')) return res.status(402).json({ success: false, error: 'feature_requires_ultimate', feature: 'security.advanced', requiredPlan: 'ultimate', message: 'Advanced security intelligence requires Ultimate.' });
  const events = await SecurityEvent.find({ guildId: req.params.guildId }).sort({ time: -1 }).limit(100).lean();
  res.json({ success: true, events });
});

app.get('/api/guilds/:guildId/reports/weekly', isAuthenticated, requireGuildManager, async (req, res) => {
  try {
    const entitlement = await getForGuild(req.params.guildId);
    const report = await generateWeeklyReport(req.params.guildId, entitlement.plan);
    res.json({ success: true, report, entitlement: { plan: entitlement.plan } });
  } catch (error) { res.status(500).json({ success: false, error: 'weekly_report_failed' }); }
});

app.get('/api/guilds/:guildId/action-center', isAuthenticated, requireGuildManager, async (req, res) => {
  try {
    const [intel, notifications] = await Promise.all([TelemetryEvent.find({ serverId: req.params.guildId, occurredAt: { $gte: new Date(Date.now() - WINDOW_MS * 2), $lt: new Date() } }).sort({ occurredAt: -1 }).limit(10000).lean().then(summarizeTelemetry), listNotifications(req.params.guildId, 50)]);
    const recommendations = [...intel.recommendations];
    if (!recommendations.length && intel.confidence === 'insufficient') recommendations.push({
      what: 'Collect more measured evidence',
      severity: 'low',
      evidence: `Only ${intel.sample?.recentEvents || 0} recent and ${intel.sample?.previousEvents || 0} comparison events are available.`,
      why: 'The system should not invent a trend from a small sample.',
      action: 'Keep the plugin online, allow scheduled player-count snapshots, and have players join and leave before reviewing intelligence again.',
    });
    const actions = recommendations.map((recommendation, index) => ({
      id: `recommendation-${index}`,
      title: recommendation.what,
      severity: recommendation.severity || 'medium',
      priority: recommendation.priority || recommendation.severity || 'medium',
      evidence: recommendation.evidence || recommendation.why,
      whyItMatters: recommendation.whyItMatters || recommendation.why,
      recommendation: recommendation.action || 'Review the measured evidence before taking an intervention.',
      confidence: intel.confidence,
      createdAt: intel.generatedAt,
      status: 'open',
      executable: false,
      action: { type: 'navigate', href: `/myservers/${encodeURIComponent(req.params.guildId)}/intelligence`, label: 'Open setup & intelligence' },
    }));
    res.json({
      success: true,
      issues: actions,
      notifications,
      evidence: { confidence: intel.confidence, sample: intel.sample, generatedAt: intel.generatedAt },
      message: actions.length ? null : 'No evidence-backed action is required right now.',
    });
  } catch (error) { res.status(500).json({ success: false, error: 'action_center_failed' }); }
});

app.get('/api/guilds/:guildId/audit', isAuthenticated, requireGuildManager, async (req, res) => {
  const logs = await AuditLog.find({ guildId: req.params.guildId }).sort({ timestamp: -1 }).limit(100).lean();
  res.json({ success: true, logs });
});

app.get('/api/guilds/:guildId/notifications', isAuthenticated, requireGuildManager, async (req, res) => {
  res.json({ success: true, notifications: await listNotifications(req.params.guildId, Number(req.query.limit) || 50) });
});

app.patch('/api/guilds/:guildId/notifications/:notificationId/read', isAuthenticated, requireGuildManager, async (req, res) => {
  const notification = await markRead(req.params.guildId, req.params.notificationId);
  if (!notification) return res.status(404).json({ success: false, error: 'notification_not_found' });
  res.json({ success: true, notification });
});

app.patch('/api/guilds/:guildId/notifications/:notificationId/resolve', isAuthenticated, requireGuildManager, async (req, res) => {
  const notification = await resolveNotification(req.params.guildId, req.params.notificationId);
  if (!notification) return res.status(404).json({ success: false, error: 'notification_not_found' });
  res.json({ success: true, notification });
});

app.get('/api/guilds/:guildId/intelligence/explanation', isAuthenticated, requireGuildManager, async (req, res) => {
  const entitlement = await getForGuild(req.params.guildId);
  if (!hasFeature(entitlement, 'server.intelligence.advanced')) return res.status(402).json({ success: false, error: 'feature_requires_pro', requiredPlan: 'pro', message: 'Evidence interpretation requires Pro.' });
  try {
    const events = await TelemetryEvent.find({ serverId: req.params.guildId, occurredAt: { $gte: new Date(Date.now() - WINDOW_MS * 2), $lt: new Date() } }).sort({ occurredAt: -1 }).limit(10000).lean();
    const deterministic = summarizeTelemetry(events);
    res.json({ success: true, aiConfigured: aiAvailable(), interpretation: await interpretEvidence(deterministic), deterministic });
  } catch (error) { res.status(500).json({ success: false, error: 'intelligence_explanation_failed' }); }
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
    const networkId = String(req.body?.networkId || '').trim().slice(0, 64) || null;
    const minecraftServerId = String(req.body?.minecraftServerId || '').trim().slice(0, 64) || instanceId;
    const serverName = String(req.body?.serverName || '').trim().slice(0, 120) || null;
    const accessToken = `pmc_${crypto.randomBytes(32).toString('base64url')}`;
    const signingSecret = crypto.randomBytes(32).toString('base64url');
    await PluginCredential.findOneAndUpdate({ serverId: req.params.guildId, instanceId }, { serverId: req.params.guildId, instanceId, accessTokenHash: hashToken(accessToken), encryptedSigningSecret: encryptSecret(signingSecret), protocolVersion: '1', revokedAt: null, lastRotatedAt: new Date() }, { upsert: true, new: true, setDefaultsOnInsert: true });
    await PluginInstance.findOneAndUpdate({ serverId: req.params.guildId, instanceId }, { $set: { networkId, minecraftServerId, serverName, protocolVersion: '1', status: 'offline', revokedAt: null }, $setOnInsert: { firstSeenAt: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    await recordAudit({ actorId: req.user.id, guildId: req.params.guildId, action: 'plugin_provisioned', feature: 'plugin.connection', result: 'success', source: 'dashboard', target: instanceId, metadata: { networkId, minecraftServerId } });
    res.status(201).json({ success: true, oneTimeConfig: { baseUrl: `${req.protocol}://${req.get('host')}`, serverId: req.params.guildId, instanceId, networkId, minecraftServerId, serverName, accessToken, signingSecret, protocolVersion: '1' }, warning: 'Store these credentials in the plugin config.yml. They are not returned again.' });
  } catch (error) { console.error('[plugin provision] error:', error.message); res.status(500).json({ success: false, error: 'plugin_provision_failed' }); }
});

app.delete('/api/guilds/:guildId/plugin/:instanceId', isAuthenticated, requireGuildManager, async (req, res) => {
  const instanceId = String(req.params.instanceId || '').slice(0, 64);
  const result = await PluginCredential.updateOne({ serverId: req.params.guildId, instanceId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  await PluginInstance.updateOne({ serverId: req.params.guildId, instanceId }, { $set: { status: 'offline', revokedAt: new Date() } });
  await recordAudit({ actorId: req.user.id, guildId: req.params.guildId, action: 'plugin_revoked', feature: 'plugin.connection', result: result.modifiedCount > 0 ? 'success' : 'failure', source: 'dashboard', target: instanceId });
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
    res.json({ success: true, service: 'promcbot', uptimeSeconds: Math.floor(process.uptime()), mongoReadyState: mongoose.connection.readyState, telemetry24h: await TelemetryEvent.countDocuments({ receivedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }), pluginInstances: await PluginInstance.countDocuments({ revokedAt: null }), automationRules: await AutomationRule.countDocuments({ enabled: true }), auditLogs24h: await AuditLog.countDocuments({ timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }), securityEvents24h: await SecurityEvent.countDocuments({ time: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }), timestamp: new Date().toISOString() });
  } catch (error) { res.status(500).json({ success: false, error: 'observability_failed' }); }
});

app.post('/api/guilds/:guildId/automation', isAuthenticated, requireGuildManager, async (req, res) => {
  try {
    const body = req.body || {};
    const trigger = body.trigger === 'weekly_summary' ? 'weekly_summary' : 'activity_decline';
    const entitlement = await getForGuild(req.params.guildId);
    const required = trigger === 'weekly_summary' ? 'automation.advanced' : 'automation.basic';
    if (!hasFeature(entitlement, required)) return res.status(402).json({ success: false, error: 'feature_requires_pro', feature: required, requiredPlan: 'pro', message: 'This automation requires Pro; basic server alerts remain available.' });
    const usage = await consumeUsage(req.params.guildId, 'automation');
    if (!usage.allowed) return res.status(429).json({ success: false, error: 'usage_limit_reached', feature: 'automation', used: usage.used, limit: usage.limit, plan: entitlement.plan });
    const rule = await AutomationRule.create({ serverId: req.params.guildId, name: String(body.name || 'Activity decline alert').slice(0, 120), enabled: body.enabled !== false, trigger, thresholdPercent: Number.isFinite(Number(body.thresholdPercent)) ? Number(body.thresholdPercent) : -5, action: 'discord_message', channelId: String(body.channelId || '').slice(0, 32), messageTemplate: String(body.messageTemplate || 'ProMcBot detected a measured activity decline: {{activityChange}}.').slice(0, 1500), cooldownMinutes: Math.min(43200, Math.max(60, Number(body.cooldownMinutes) || 1440)), createdBy: req.user.id });
    await recordAudit({ actorId: req.user.id, guildId: req.params.guildId, action: 'automation_created', feature: required, result: 'success', source: 'dashboard', target: String(rule._id), metadata: { trigger } });
    res.status(201).json({ success: true, rule, usage });
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
  if (mongoose.connection.readyState === 1) {
    const botClient = getBotClient();
    if (botClient) runEnabledRules(botClient).catch(error => console.error('[automation] cycle failed:', error.message));
  }
}, 5 * 60 * 1000);
if (typeof automationInterval.unref === 'function') automationInterval.unref();

// 404 Handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(dashDir, '404', '404.html'));
});

module.exports = { app };
