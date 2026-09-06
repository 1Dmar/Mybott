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
const ChangelogEntry = require('../bot/Models/ChangelogEntry');
const AdminMember = require('../bot/Models/AdminMember');
const PartnerApplication = require('../bot/Models/PartnerApplication');
const Partner = require('../bot/Models/Partner');
const { normalizeApplicationInput, validateApplication, approveApplication, renewPartner, endPartner, getActivePartnerDiscount, PARTNER_DISCOUNT_PERCENTAGE, PARTNER_PRODUCT } = require('../bot/utils/partnerService');
const { DEFAULT_CHANGELOG_ENTRIES } = require('../bot/utils/changelogData');
const { summarizeTelemetry, WINDOW_MS } = require('../bot/utils/intelligenceEngine');
const { analyzePlayers } = require('../bot/utils/playerIntelligenceEngine');
const { summarizeNetwork } = require('../bot/utils/networkIntelligenceEngine');
const { interpretEvidence, available: aiAvailable } = require('../bot/utils/aiInterpretationEngine');
const { runEnabledRules } = require('../bot/utils/automationEngine');
const { PLANS, getPlan, getEntitlement, hasFeature, requiredPlanFor, PLAN_ORDER } = require('../bot/utils/entitlements');
const Subscription = require('../bot/Models/Subscription');
const Payment = require('../bot/Models/Payment');
const Invoice = require('../bot/Models/Invoice');
const BillingEvent = require('../bot/Models/BillingEvent');
const Report = require('../bot/Models/Report');
const Notification = require('../bot/Models/Notification');
const SecurityEvent = require('../bot/Models/SecurityEvent');
const AuditLog = require('../bot/Models/AuditLog');
const { getForGuild, ensureFreeSubscription, consumeUsage, releaseUsage } = require('../bot/utils/entitlementService');
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
const { validatePublicUsername, normalizePublicUsername } = require('./publicProfile');
const { renderPublicProfileCard } = require('./publicProfileCard');
const { buildTelemetryDocuments, buildTelemetryBulkOperations, summarizeTelemetryWrite, MAX_EVENTS } = require('./telemetryIngest');
const { isAllowedCorsOrigin, isSameOriginMutation } = require('./securityPolicy');
const { buildPublicBaseUrl } = require('./urlPolicy');
const { getSessionSecret, sanitizeDiscordProfile } = require('./authPolicy');
const { operationIdForRequest } = require('./observability');
const { mapWithConcurrency } = require('./asyncPool');
const { getTrustpilotStats } = require('./trustpilotStats');
const { getSmartActionPreset, getSmartActionState, validateSmartActionChannel } = require('../bot/utils/smartActions');

// ── Models ──────────────────────────────────────────────────────
const ServerInfo     = require('../bot/Models/Server');
const GuildSettings  = require('../bot/Models/GuildSettings');
const BotConfig       = require('../bot/Models/BotConfig');
const UserProfile      = require('../bot/Models/UserProfile');
const ProfileFollow    = require('../bot/Models/ProfileFollow');
const ProfileLike      = require('../bot/Models/ProfileLike');

// ── Express App ──────────────────────────────────────────────────
const app = express();
const dashboardApiLimiter = rateLimit({ windowMs: 60 * 1000, max: 180, standardHeaders: true, legacyHeaders: false, message: { success: false, error: 'dashboard_api_rate_limited' } });

app.use((req, res, next) => {
  req.operationId = operationIdForRequest(req.get('x-request-id'));
  res.set('X-Request-Id', req.operationId);
  next();
});

app.use(cors({
  origin: (origin, callback) => callback(null, isAllowedCorsOrigin(origin)),
  credentials: true,
  exposedHeaders: ['X-Request-Id'],
  methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json({
  limit: '512kb',
  verify: (req, res, buffer) => {
    if (req.path === '/api/v1/telemetry/events' || req.path === '/api/v1/plugin/capabilities' || req.path.startsWith('/api/billing/webhook/')) req.rawBody = Buffer.from(buffer);
  }
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const isExternalProtocol = req.path.startsWith('/api/v1/') || req.path.startsWith('/api/billing/webhook/');
  if (!isExternalProtocol && !isSameOriginMutation(req)) return res.status(403).json({ success: false, error: 'cross_origin_request_blocked' });
  next();
});
app.use(cookieParser());
app.use('/api/guilds', dashboardApiLimiter);

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
app.post('/api/billing/webhook/:provider', rateLimit({ windowMs: 60 * 1000, max: 60 }), requireDatabaseReady, async (req, res) => {
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
app.get('/api/v1/plugin/capabilities', rateLimit({ windowMs: 60 * 1000, max: 120 }), requireDatabaseReady, async (req, res) => {
  try {
    const auth = await authenticatePluginRequest(req, req.rawBody || Buffer.from(''));
    if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error });
    const entitlement = await getForGuild(auth.serverId);
    const body = JSON.stringify({ success: true, protocolVersion: auth.protocolVersion, serverId: auth.serverId, instanceId: auth.instanceId, plan: entitlement.plan, features: entitlement.features, limits: entitlement.limits, expiresAt: entitlement.currentPeriodEnd || null });
    const response = res.status(200).json(JSON.parse(body));
    void response;
  } catch (error) { console.error('[plugin capabilities] error:', error.message); res.status(500).json({ success: false, error: 'capabilities_failed' }); }
});

app.post('/api/v1/telemetry/events', rateLimit({ windowMs: 60 * 1000, max: 120 }), requireDatabaseReady, async (req, res) => {
  try {
    const auth = await authenticatePluginRequest(req, req.rawBody || Buffer.from(''));
    if (!auth.ok) {
      if (['invalid_signature', 'replayed_request', 'plugin_not_provisioned'].includes(auth.error)) await recordSecurityEvent({ guildId: req.get('x-promcbot-server') || 'unknown', instanceId: req.get('x-promcbot-instance') || null, event: auth.error, severity: auth.error === 'invalid_signature' ? 'high' : 'medium', evidence: { source: 'plugin_protocol', timestamp: req.get('x-promcbot-timestamp') || null }, action: 'review_or_revoke' }).catch(() => null);
      return res.status(auth.status).json({ success: false, error: auth.error });
    }
    const incoming = Array.isArray(req.body?.events) ? req.body.events.slice(0, MAX_EVENTS) : [];
    if (!incoming.length) return res.status(400).json({ success: false, error: 'events_required' });
    const documents = buildTelemetryDocuments(incoming, {
      serverId: auth.serverId,
      instanceId: auth.instanceId,
      nonce: req.get('x-promcbot-nonce'),
    });
    const writeResult = await TelemetryEvent.bulkWrite(buildTelemetryBulkOperations(documents), { ordered: false });
    const { accepted: acceptedCount, duplicates: duplicateCount } = summarizeTelemetryWrite(writeResult, documents.length);
    const latestCount = latestOnlinePlayers(documents);
    const headerValue = name => String(req.get(name) || '').trim().slice(0, 120) || null;
    await PluginInstance.findOneAndUpdate({ serverId: auth.serverId, instanceId: auth.instanceId }, { $set: { protocolVersion: auth.protocolVersion, lastSeenAt: new Date(), status: 'online', ...(latestCount === null ? {} : { lastOnlinePlayers: latestCount }), ...(headerValue('x-promcbot-network') ? { networkId: headerValue('x-promcbot-network') } : {}), ...(headerValue('x-promcbot-minecraft-server') ? { minecraftServerId: headerValue('x-promcbot-minecraft-server') } : {}), ...(headerValue('x-promcbot-server-name') ? { serverName: headerValue('x-promcbot-server-name') } : {}) }, $setOnInsert: { firstSeenAt: new Date() } }, { upsert: true });
    res.status(202).json({ success: true, accepted: acceptedCount, duplicate: duplicateCount > 0, duplicates: duplicateCount, serverId: auth.serverId, instanceId: auth.instanceId });
  } catch (error) {
    if (error?.code === 11000) return res.status(202).json({ success: true, accepted: 0, duplicate: true, duplicates: 1 });
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
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
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

function getOAuthLoginWebhookUrl() {
  const directUrl = String(process.env.DISCORD_OAUTH_LOGIN_WEBHOOK_URL || process.env.WEBHOOK_URL || '').trim();
  if (directUrl) return directUrl;
  const webhookId = String(process.env.WEBHOOK_ID || '').trim();
  const webhookToken = String(process.env.WEBHOOK_TOKEN || '').trim();
  return webhookId && webhookToken ? `https://discord.com/api/webhooks/${encodeURIComponent(webhookId)}/${encodeURIComponent(webhookToken)}` : '';
}

async function notifyDiscordOAuthLogin(profile) {
  const webhookUrl = getOAuthLoginWebhookUrl();
  if (!webhookUrl || !/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+$/.test(webhookUrl)) return;
  const now = Date.now();
  const displayName = String(profile?.global_name || profile?.globalName || profile?.username || 'Unknown user').slice(0, 100);
  const username = String(profile?.username || 'unknown').slice(0, 100);
  const userId = String(profile?.id || 'unknown').slice(0, 32);
  const avatarUrl = profile?.avatar && /^\d+$/.test(userId)
    ? `https://cdn.discordapp.com/avatars/${userId}/${encodeURIComponent(String(profile.avatar))}.png?size=256`
    : null;
  const embed = {
    color: 0x4070f4,
    title: '🔹 تسجيل دخول جديد',
    fields: [
      { name: '👤 الاسم', value: `${displayName} (${username})`.slice(0, 1024), inline: true },
      { name: '🆔 المعرف', value: userId, inline: true },
      { name: '⏳ التاريخ', value: new Date(now).toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }), inline: true }
    ],
    footer: { text: 'ProMcBot Dashboard' },
    timestamp: new Date(now).toISOString()
  };
  if (avatarUrl) embed.thumbnail = { url: avatarUrl };
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'ProMcBot-OAuth-Logger/1.0' },
      body: JSON.stringify({ username: 'ProMcBot Dashboard', embeds: [embed], allowed_mentions: { parse: [] } }, null, 0),
      signal: AbortSignal.timeout(8000)
    });
  } catch (_) {
    // Login must never fail because monitoring delivery is unavailable.
  }
}

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
      state: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      const safeProfile = sanitizeDiscordProfile(profile);
      void notifyDiscordOAuthLogin(profile);
      return done(null, safeProfile);
    }
  ));
}

passport.serializeUser((user, done) => done(null, sanitizeDiscordProfile(user)));
passport.deserializeUser((user, done) => done(null, sanitizeDiscordProfile(user)));

// ── Auth Guard ──────────────────────────────────────────────────────
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  if (req.path.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ authenticated: false, error: 'authentication_required' });
  }
  res.redirect('/loading-auth');
}

const DEFAULT_PROFILE_OWNER_ID = '804999528129363998';
// Admin access is decided only from the authenticated Discord session on the server.
// The environment override allows ownership rotation without a code change; the supplied owner ID remains the safe default.
const ADMIN_DISCORD_IDS = new Set([DEFAULT_PROFILE_OWNER_ID, ...String(process.env.ADMIN_DISCORD_IDS || '').split(',').map(value => value.trim()).filter(Boolean)]);
const ADMIN_ROLE_RANK = { editor: 1, admin: 2, owner: 3 };
async function getAdminRole(req) {
  const id = String(req.user?.id || '');
  if (!id) return null;
  if (id === DEFAULT_PROFILE_OWNER_ID) return 'owner';
  if (ADMIN_DISCORD_IDS.has(id)) return 'admin';
  if (mongoose.connection.readyState !== 1) return null;
  const member = await AdminMember.findOne({ discordId: id }).lean();
  return member?.role || null;
}
async function isAdminUser(req) { return Boolean(await getAdminRole(req)); }
async function requireAdmin(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  if (await isAdminUser(req)) return next();
  if (req.path.startsWith('/api/')) return res.status(404).json({ success: false, error: 'not_found' });
  return res.status(404).send('Not found');
}
async function requireAdminRole(req, res, next) {
  const role = await getAdminRole(req);
  if (!role) return res.status(404).json({ success: false, error: 'not_found' });
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  req.adminRole = role;
  next();
}
function normalizeChangelogPayload(body, createdBy) {
  const categories = Array.isArray(body?.categories) ? body.categories : String(body?.categories || '').split(',');
  const sections = Array.isArray(body?.sections) ? body.sections : [];
  const imageType = ['banner', 'thumbnail'].includes(String(body?.imageType || '').toLowerCase()) ? String(body.imageType).toLowerCase() : null;
  const rawImageUrl = String(body?.imageUrl || '').trim().slice(0, 1000);
  let imageUrl = null;
  try { const parsed = new URL(rawImageUrl); if (imageType && ['http:', 'https:'].includes(parsed.protocol)) imageUrl = parsed.toString(); } catch (_) {}
  return {
    version: String(body?.version || '').trim().slice(0, 32), date: String(body?.date || '').trim().slice(0, 80),
    title: String(body?.title || '').trim().slice(0, 140), description: String(body?.description || '').trim().slice(0, 500),
    imageType, imageUrl,
    categories: [...new Set(categories.map(value => String(value).trim().toUpperCase()).filter(value => ['NEW', 'IMPROVED', 'FIXED', 'SECURITY'].includes(value)))].slice(0, 4),
    sections: sections.map(section => ({ title: String(section?.title || '').trim().slice(0, 80), items: (Array.isArray(section?.items) ? section.items : []).map(item => String(item).trim().slice(0, 240)).filter(Boolean).slice(0, 12) })).filter(section => section.title && section.items.length).slice(0, 6),
    createdBy,
  };
}
async function seedChangelogIfEmpty() {
  if (mongoose.connection.readyState !== 1 || await ChangelogEntry.exists()) return;
  await ChangelogEntry.insertMany(DEFAULT_CHANGELOG_ENTRIES.map(entry => ({ ...entry, createdBy: 'system' })));
}

async function ensureDefaultProfileFollow(followerId) {
  if (!followerId || followerId === DEFAULT_PROFILE_OWNER_ID || mongoose.connection.readyState !== 1) return;
  try {
    await ProfileFollow.updateOne({ followerId, profileUserId: DEFAULT_PROFILE_OWNER_ID }, { $setOnInsert: { followerId, profileUserId: DEFAULT_PROFILE_OWNER_ID, createdAt: new Date() } }, { upsert: true });
  } catch (error) {
    if (error?.code !== 11000) console.warn('[profile follow] automatic follow skipped:', error.message);
  }
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
const SEO_BASE_URL = 'https://promcbot.dev';
const SEO_NEWLINE = String.fromCharCode(10);
const escapeXml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[character]));

async function getPublicSitemapUrls() {
  const urls = [
    { loc: `${SEO_BASE_URL}/`, priority: '1.0' },
    { loc: `${SEO_BASE_URL}/changelog`, priority: '0.8' },
    { loc: `${SEO_BASE_URL}/privacy-policy`, priority: '0.5' },
    { loc: `${SEO_BASE_URL}/terms-of-service`, priority: '0.5' },
    { loc: `${SEO_BASE_URL}/stats`, priority: '0.7' },
  ];
  if (mongoose.connection.readyState !== 1) return urls;
  const configuredProfiles = await UserProfile.find({ username: { $type: 'string', $ne: '' } }).select('username updatedAt').sort({ updatedAt: -1 }).limit(10000).lean();
  const profiles = await mapWithConcurrency(configuredProfiles, async profile => {
    try {
      const data = await resolvePublicProfile(profile.username);
      const username = data?.profile?.username;
      if (!username) return null;
      return { loc: `${SEO_BASE_URL}/u/${encodeURIComponent(username)}`, lastmod: profile.updatedAt ? new Date(profile.updatedAt).toISOString() : null, priority: '0.6' };
    } catch (_) {
      return null;
    }
  }, 8);
  return urls.concat(profiles.filter(Boolean));
}

// Direct static URLs must not bypass the protected Admin page routes below.
app.use(['/dashboard/pages/admin-changelog.html', '/dashboard/pages/admin-partners.html'], async (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  if (await isAdminUser(req)) return next();
  return res.status(404).send('Not found');
});
app.use('/dashboard', express.static(dashDir));
app.use('/public', express.static(path.join(__dirname, '..', 'bot', 'public')));

app.get('/api/trustpilot/stats', rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false }), (req, res) => {
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
  res.json(getTrustpilotStats());
});

// ── Routes ───────────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0').send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /dashboard/dashboard.html',
    'Disallow: /dashboard/home.html',
    'Disallow: /dashboard/pages/',
    'Disallow: /dashboard/Loading/',
    'Disallow: /myservers',
    'Disallow: /actions',
    'Disallow: /smart-actions',
    'Disallow: /admin',
    'Disallow: /api',
    'Disallow: /auth',
    'Disallow: /loading-auth',
    `Sitemap: ${SEO_BASE_URL}/sitemap.xml`,
    '',
  ].join(SEO_NEWLINE));
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const urls = await getPublicSitemapUrls();
    const body = urls.map(({ loc, lastmod, priority }) => `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ''}<changefreq>weekly</changefreq><priority>${priority}</priority></url>`).join(SEO_NEWLINE);
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      body,
      '</urlset>',
      '',
    ].join(SEO_NEWLINE);
    res.type('application/xml').set('Cache-Control', 'public, max-age=300, stale-while-revalidate=900').send(xml);
  } catch (error) {
    console.error('[seo] sitemap generation failed:', error.message);
    res.status(503).type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

app.get('/', (req, res) => res.sendFile(path.join(dashDir, 'home.html')));
const docsPages = {
  '/docs': 'index.html',
  '/docs/getting-started': 'getting-started.html',
  '/docs/bot-commands': 'bot-commands.html',
  '/docs/intelligence': 'intelligence.html',
  '/docs/dashboard': 'dashboard.html',
  '/docs/minecraft-plugin': 'minecraft-plugin.html',
  '/docs/security': 'security.html',
  '/docs/compatibility': 'compatibility.html',
  '/docs/faq': 'faq.html',
};
Object.entries(docsPages).forEach(([route, file]) => {
  app.get(route, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'docs', file)));
});
app.get('/changelog', (req, res) => res.sendFile(path.join(dashDir, 'pages', 'changelog.html')));
const legalPages = {
  '/privacy-policy': 'PrivacyPolicy.html',
  '/terms-of-service': 'TermsOfService.html',
  '/changelog': 'changelog.html',
};
Object.entries(legalPages).forEach(([route, file]) => {
  app.get(route, (req, res) => res.sendFile(path.join(dashDir, 'pages', file)));
});
app.get('/admin/changelog', isAuthenticated, requireAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'admin-changelog.html')));
app.get('/partners', (req, res) => res.sendFile(path.join(dashDir, 'pages', 'partners.html')));
app.get('/partners/apply', isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'partner-apply.html')));
app.get('/api/partners/me', isAuthenticated, async (req, res) => {
  const [application, partner] = mongoose.connection.readyState === 1 ? await Promise.all([
    PartnerApplication.findOne({ applicantUserId: req.user.id }).sort({ submittedAt: -1 }).lean(),
    Partner.findOne({ userId: req.user.id }).lean(),
  ]) : [null, null];
  res.json({ success: true, user: { id: req.user.id, username: req.user.username, global_name: req.user.global_name }, application, partner });
});
app.post('/api/partners/applications', isAuthenticated, requireDatabaseReady, async (req, res) => {
  const information = normalizeApplicationInput(req.body, req.user);
  const validationError = validateApplication(information, req.user.id);
  if (validationError) return res.status(400).json({ success: false, error: validationError });
  const existing = await PartnerApplication.findOne({ applicantUserId: req.user.id, status: { $in: ['PENDING', 'UNDER_REVIEW', 'APPROVED'] } }).lean();
  if (existing) return res.status(409).json({ success: false, error: 'active_application_exists' });
  const application = await PartnerApplication.create({ applicantUserId: req.user.id, information });
  await recordAudit({ actorId: req.user.id, guildId: req.user.id, action: 'partner_application_submitted', feature: 'partner', result: 'success', source: 'dashboard', target: String(application._id) }).catch(() => null);
  void notifyPartnerDiscord('submitted', { application });
  res.status(201).json({ success: true, applicationId: application._id });
});
app.get('/api/partners/discount-quote', isAuthenticated, requireDatabaseReady, async (req, res) => {
  const product = String(req.query.product || '').trim().toLowerCase();
  const amount = Number(req.query.amount);
  if (product !== PARTNER_PRODUCT || !Number.isFinite(amount) || amount < 0) return res.status(400).json({ success: false, error: 'invalid_discount_request' });
  const discount = await getActivePartnerDiscount(req.user.id, product);
  const percentage = discount ? PARTNER_DISCOUNT_PERCENTAGE : 0;
  res.json({ success: true, product, percentage, originalAmount: amount, discountAmount: Math.round(amount * percentage) / 100, finalAmount: Math.round(amount * (100 - percentage)) / 100 });
});
app.get('/admin/partners', isAuthenticated, requireAdmin, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'admin-partners.html')));
async function notifyPartnerDiscord(event, data) {
  const channelId = String(process.env.PARTNER_APPLICATION_CHANNEL_ID || '').trim();
  const channel = channelId ? global.__botClient?.channels?.cache?.get(channelId) : null;
  if (!channel?.send) return;
  const application = data.application;
  const partner = data.partner;
  const info = application?.information || {};
  const fields = event === 'submitted' ? [
    { name: 'Applicant', value: '<@' + application.applicantUserId + '>', inline: true },
    { name: 'Discord', value: String(info.discordUsername || 'Unknown'), inline: true },
    { name: 'Community', value: String(info.communityName || 'Unknown'), inline: true },
    { name: 'Size', value: String(info.communitySize || 'Unknown'), inline: true },
    { name: 'Website / Invite', value: String(info.websiteOrInvite || 'Unknown').slice(0, 1024), inline: false },
    { name: 'Reason', value: String(info.whyPartner || info.description || 'Not provided').slice(0, 1024), inline: false },
    { name: 'Offer', value: String(info.offer || 'Not provided').slice(0, 1024), inline: false },
    { name: 'Application ID', value: String(application._id), inline: true },
    { name: 'Status', value: String(application.status), inline: true },
  ] : event === 'approved' ? [
    { name: 'Discord user', value: '<@' + application.applicantUserId + '>', inline: true },
    { name: 'Partner status', value: 'ACTIVE', inline: true },
    { name: 'Pro Premium', value: '90 days', inline: true },
    { name: 'Discount', value: '25% on Pro Premium', inline: true },
    { name: 'Start', value: new Date(partner.startedAt).toISOString(), inline: true },
    { name: 'Expiration', value: new Date(partner.expiresAt).toISOString(), inline: true },
  ] : [{ name: 'Applicant', value: '<@' + application.applicantUserId + '>', inline: true }, { name: 'Result', value: 'Rejected', inline: true }, { name: 'Reason', value: String(application.rejectionReason || 'Not provided').slice(0, 1024), inline: false }];
  try { await channel.send({ embeds: [{ color: event === 'approved' ? 0x22c55e : event === 'rejected' ? 0xef4444 : 0x5865f2, title: event === 'approved' ? 'Partner approved' : event === 'rejected' ? 'Partner application rejected' : 'New Partner application', fields, timestamp: new Date().toISOString() }] }); }
  catch (error) { console.error('[partner discord] notification failed:', error.message); }
}
app.get('/api/admin/partners/applications', isAuthenticated, requireAdminRole, requireDatabaseReady, async (req, res) => {
  const filter = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(req.query.status) ? { status: req.query.status } : {};
  res.json({ success: true, applications: await PartnerApplication.find(filter).sort({ submittedAt: -1 }).lean() });
});
app.get('/api/admin/partners/applications/:id', isAuthenticated, requireAdminRole, requireDatabaseReady, async (req, res) => { const item = await PartnerApplication.findById(req.params.id).lean(); return item ? res.json({ success: true, application: item }) : res.status(404).json({ success: false, error: 'application_not_found' }); });
app.post('/api/admin/partners/applications/:id/review', isAuthenticated, requireAdminRole, requireDatabaseReady, async (req, res) => {
  const item = await PartnerApplication.findOneAndUpdate({ _id: req.params.id, status: 'PENDING' }, { $set: { status: 'UNDER_REVIEW', reviewedBy: req.user.id, reviewedAt: new Date(), adminNotes: String(req.body?.adminNotes || '').slice(0, 3000) } }, { new: true });
  if (!item) return res.status(409).json({ success: false, error: 'application_not_pending' });
  await recordAudit({ actorId: req.user.id, guildId: item.applicantUserId, action: 'partner_marked_under_review', feature: 'partner', result: 'success', source: 'admin_dashboard', target: String(item._id) }).catch(() => null);
  res.json({ success: true, application: item });
});
app.post('/api/admin/partners/applications/:id/approve', isAuthenticated, requireAdminRole, requireDatabaseReady, async (req, res) => {
  try {
    const result = await approveApplication(req.params.id, req.user.id);
    const application = result.application || await PartnerApplication.findById(req.params.id).lean();
    await recordAudit({ actorId: req.user.id, guildId: application.applicantUserId, action: result.idempotent ? 'partner_approval_replayed' : 'partner_approved', feature: 'partner', result: 'success', source: 'admin_dashboard', target: String(application._id), metadata: { partnerId: String(result.partner._id), discountPercentage: 25, premiumDays: 90 } }).catch(() => null);
    if (!result.idempotent) void notifyPartnerDiscord('approved', { application, partner: result.partner });
    res.json({ success: true, idempotent: Boolean(result.idempotent), partner: result.partner });
  } catch (error) { res.status(error.status || 400).json({ success: false, error: error.message }); }
});
app.post('/api/admin/partners/applications/:id/reject', isAuthenticated, requireAdminRole, requireDatabaseReady, async (req, res) => {
  const item = await PartnerApplication.findOneAndUpdate({ _id: req.params.id, status: { $in: ['PENDING', 'UNDER_REVIEW'] } }, { $set: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: req.user.id, rejectionReason: String(req.body?.rejectionReason || '').slice(0, 2000), adminNotes: String(req.body?.adminNotes || '').slice(0, 3000) } }, { new: true });
  if (!item) return res.status(409).json({ success: false, error: 'application_not_rejectable' });
  await recordAudit({ actorId: req.user.id, guildId: item.applicantUserId, action: 'partner_rejected', feature: 'partner', result: 'success', source: 'admin_dashboard', target: String(item._id) }).catch(() => null);
  void notifyPartnerDiscord('rejected', { application: item });
  res.json({ success: true, application: item });
});
app.get('/api/admin/partners', isAuthenticated, requireAdminRole, requireDatabaseReady, async (req, res) => {
  const partners = await Partner.find().sort({ createdAt: -1 }).lean();
  const counts = await PartnerApplication.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  res.json({ success: true, partners, stats: Object.fromEntries(counts.map(x => [x._id, x.count])) });
});
app.get('/api/admin/partners/:id', isAuthenticated, requireAdminRole, requireDatabaseReady, async (req, res) => {
  const partner = await Partner.findById(req.params.id).lean();
  if (!partner) return res.status(404).json({ success: false, error: 'partner_not_found' });
  const [application, history] = await Promise.all([PartnerApplication.findById(partner.applicationId).lean(), AuditLog.find({ guildId: partner.userId, feature: 'partner' }).sort({ timestamp: -1 }).limit(100).lean()]);
  res.json({ success: true, partner, application, history });
});
app.post('/api/admin/partners/:id/renew', isAuthenticated, requireAdminRole, requireDatabaseReady, async (req, res) => { try { const partner = await renewPartner(req.params.id, req.user.id); await recordAudit({ actorId: req.user.id, guildId: partner.userId, action: 'partner_premium_renewed', feature: 'partner', result: 'success', source: 'admin_dashboard', target: String(partner._id), metadata: { premiumDays: 90 } }).catch(() => null); res.json({ success: true, partner }); } catch (error) { res.status(error.status || 400).json({ success: false, error: error.message }); } });
app.post('/api/admin/partners/:id/end', isAuthenticated, requireAdminRole, requireDatabaseReady, async (req, res) => { try { const partner = await endPartner(req.params.id, req.body?.reason); await recordAudit({ actorId: req.user.id, guildId: partner.userId, action: 'partner_ended', feature: 'partner', result: 'success', source: 'admin_dashboard', target: String(partner._id), metadata: { reason: String(req.body?.reason || '').slice(0, 200) } }).catch(() => null); res.json({ success: true, partner }); } catch (error) { res.status(error.status || 400).json({ success: false, error: error.message }); } });

app.get('/api/changelog', async (req, res) => {
  try {
    await seedChangelogIfEmpty();
    const entries = mongoose.connection.readyState === 1 ? await ChangelogEntry.find().sort({ createdAt: -1 }).lean() : [];
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ success: true, entries: entries.length ? entries : DEFAULT_CHANGELOG_ENTRIES });
  } catch (_) { res.status(503).json({ success: false, error: 'changelog_unavailable' }); }
});
app.get('/api/admin/changelog', isAuthenticated, requireAdminRole, requireDatabaseReady, async (req, res) => {
  await seedChangelogIfEmpty();
  res.json({ success: true, entries: await ChangelogEntry.find().sort({ createdAt: -1 }).lean() });
});
app.post('/api/admin/changelog', isAuthenticated, requireAdminRole, requireDatabaseReady, async (req, res) => {
  try { const entry = await ChangelogEntry.create(normalizeChangelogPayload(req.body, req.user.id)); res.status(201).json({ success: true, entry }); }
  catch (error) { res.status(400).json({ success: false, error: 'invalid_changelog_entry', message: 'Check the version, title, categories, and at least one feature section.' }); }
});
app.patch('/api/admin/changelog/:id', isAuthenticated, requireAdminRole, requireDatabaseReady, async (req, res) => {
  try { const payload = normalizeChangelogPayload(req.body, req.user.id); const entry = await ChangelogEntry.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true, runValidators: true }).lean(); if (!entry) return res.status(404).json({ success: false, error: 'changelog_entry_not_found' }); res.json({ success: true, entry }); }
  catch (_) { res.status(400).json({ success: false, error: 'invalid_changelog_entry' }); }
});
app.delete('/api/admin/changelog/:id', isAuthenticated, requireAdminRole, requireDatabaseReady, async (req, res) => {
  const result = await ChangelogEntry.deleteOne({ _id: req.params.id });
  if (!result.deletedCount) return res.status(404).json({ success: false, error: 'changelog_entry_not_found' });
  res.json({ success: true });
});
app.get('/api/admin/members', isAuthenticated, requireAdminRole, requireDatabaseReady, async (req, res) => {
  const members = await AdminMember.find().sort({ createdAt: -1 }).lean();
  res.json({ success: true, actorRole: req.adminRole, members: [{ discordId: DEFAULT_PROFILE_OWNER_ID, role: 'owner', protected: true }, ...members.map(member => ({ discordId: member.discordId, role: member.role, createdAt: member.createdAt, protected: false }))] });
});
app.post('/api/admin/members', isAuthenticated, requireAdminRole, requireDatabaseReady, async (req, res) => {
  const discordId = String(req.body?.discordId || '').trim();
  const role = String(req.body?.role || '').toLowerCase();
  if (!/^\d{5,25}$/.test(discordId) || !['admin', 'editor'].includes(role)) return res.status(400).json({ success: false, error: 'invalid_admin_member' });
  if (discordId === DEFAULT_PROFILE_OWNER_ID) return res.status(409).json({ success: false, error: 'owner_already_exists' });
  if (ADMIN_ROLE_RANK[req.adminRole] <= ADMIN_ROLE_RANK[role]) return res.status(403).json({ success: false, error: 'role_management_forbidden', message: 'You may only grant a role lower than your own.' });
  try { const member = await AdminMember.create({ discordId, role, createdBy: req.user.id }); res.status(201).json({ success: true, member: { discordId: member.discordId, role: member.role } }); }
  catch (error) { res.status(error?.code === 11000 ? 409 : 400).json({ success: false, error: error?.code === 11000 ? 'admin_member_exists' : 'invalid_admin_member' }); }
});
app.delete('/api/admin/members/:discordId', isAuthenticated, requireAdminRole, requireDatabaseReady, async (req, res) => {
  const discordId = String(req.params.discordId || '');
  if (discordId === DEFAULT_PROFILE_OWNER_ID) return res.status(403).json({ success: false, error: 'owner_protected' });
  const target = await AdminMember.findOne({ discordId }).lean();
  if (!target) return res.status(404).json({ success: false, error: 'admin_member_not_found' });
  if (ADMIN_ROLE_RANK[req.adminRole] <= ADMIN_ROLE_RANK[target.role]) return res.status(403).json({ success: false, error: 'role_management_forbidden', message: 'A role can only be removed by someone higher in the hierarchy.' });
  await AdminMember.deleteOne({ discordId });
  res.json({ success: true });
});
app.get('/privacy', (req, res) => res.redirect(308, '/privacy-policy'));
app.get('/terms', (req, res) => res.redirect(308, '/terms-of-service'));
app.get('/loading-auth', (req, res) => res.sendFile(path.join(dashDir, 'Loading', 'loading.html')));
app.get('/invitebot', (req, res) => {
  const inviteUrl = buildBotInviteUrl(DISCORD_CLIENT_ID);
  if (!inviteUrl) return res.status(503).send('Discord invite is not configured.');
  return res.redirect(302, inviteUrl);
});

app.get('/auth/discord', (req, res, next) => {
  if (!discordOAuthConfigured) return res.status(503).send('Discord login is not configured.');
  return passport.authenticate('discord')(req, res, next);
});
app.get('/auth/discord/callback', (req, res, next) => {
  if (!discordOAuthConfigured) return res.status(503).send('Discord login is not configured.');
  return passport.authenticate('discord', { failureRedirect: '/' })(req, res, next);
}, async (req, res) => {
  try {
    const authenticatedUser = req.user;
    await new Promise((resolve, reject) => {
      req.session.regenerate(error => {
        if (error) return reject(error);
        req.logIn(authenticatedUser, loginError => loginError ? reject(loginError) : resolve());
      });
    });
    await ensureDefaultProfileFollow(req.user?.id);
    res.redirect('/dashboard');
  } catch (error) {
    console.error('[oauth callback] session initialization failed:', error.message);
    res.redirect('/');
  }
});

function completeLogout(req, res) {
  const finish = error => {
    if (error) {
      console.error('[logout] passport logout failed:', error.message);
      return res.status(500).json({ success: false, error: 'logout_failed' });
    }
    const clear = () => {
      res.clearCookie('connect.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
      if (req.accepts('json') || req.get('x-requested-with') === 'XMLHttpRequest') return res.json({ success: true });
      return res.redirect('/');
    };
    if (req.session) return req.session.destroy(destroyError => destroyError ? finish(destroyError) : clear());
    return clear();
  };
  return req.logout(finish);
}

app.get('/api/logout', completeLogout);
app.post('/api/logout', completeLogout);

// ── User API ──────────────────────────────────────────────────────
app.get('/api/user/profile', isAuthenticated, async (req, res) => {
  try {
    const settings = mongoose.connection.readyState === 1 ? await UserProfile.findOne({ userId: req.user.id }).lean() : null;
    res.json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        public_username: settings?.username || '',
        public_url: settings?.username ? `/u/${encodeURIComponent(settings.username)}` : `/u/${encodeURIComponent(req.user.id)}`,
        global_name: req.user.global_name || req.user.username,
        avatar: req.user.avatar ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png',
        banner: settings?.bannerType === 'image' ? settings.banner : null,
        accent_color: req.user.accent_color || '#3285ff',
        custom_status: settings?.customStatus || ''
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'profile_unavailable' });
  }
});

app.patch('/api/user/profile', isAuthenticated, async (req, res) => {
  const validation = validatePublicUsername(req.body?.public_username);
  if (!validation.ok) return res.status(validation.error === 'reserved_public_username' ? 409 : 400).json({ success: false, error: validation.error, message: validation.message });
  const username = validation.username;
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ success: false, error: 'database_unavailable', message: 'Profile settings are temporarily unavailable.' });
  try {
    const collision = await UserProfile.findOne({ username, userId: { $ne: req.user.id } }).select('_id').lean();
    if (collision) return res.status(409).json({ success: false, error: 'public_username_taken', message: 'That public username is already in use.' });
    const settings = await UserProfile.findOneAndUpdate({ userId: req.user.id }, { $set: { username, updatedAt: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    res.json({ success: true, public_username: settings.username, public_url: `/u/${encodeURIComponent(settings.username)}` });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, error: 'public_username_taken', message: 'That public username is already in use.' });
    res.status(500).json({ success: false, error: 'profile_update_failed' });
  }
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
    const baseUrl = buildPublicBaseUrl(req);
    const serverPremiumPath = `/myservers/${encodeURIComponent(req.params.guildId)}/premium`;
    const checkout = await createCheckout({ guildId: req.params.guildId, plan, method, returnUrl: `${baseUrl}${serverPremiumPath}?billing=pending`, cancelUrl: `${baseUrl}${serverPremiumPath}?billing=cancelled` });
    try {
      await recordAudit({ actorId: req.user.id, guildId: req.params.guildId, action: 'billing_checkout_created', feature: `billing.${plan}`, result: 'pending_provider_approval', source: `paypal:${method}`, target: checkout.providerSubscriptionId });
    } catch (auditError) {
      console.error('[billing checkout] audit write failed after provider checkout:', auditError.message);
    }
    res.json({ success: true, ...checkout });
  } catch (error) {
    const configurationError = ['payment_method_not_configured', 'payment_plan_not_configured', 'paypal_credentials_missing', 'paypal_approval_url_missing', 'public_base_url_not_configured', 'public_base_url_must_use_https', 'request_host_invalid'].includes(error.message);
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
  const guilds = await mapWithConcurrency(getWorkspaceGuilds(req.user), async guild => {
    try {
      return {
        ...guild,
        ...botAccessPayload(guild, await resolveBotMembership(botClient, guild.id), inviteUrl),
      };
    } catch (_) {
      return { ...guild, ...botAccessPayload(guild, { state: 'unknown', installed: false }, inviteUrl) };
    }
  }, 4);
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

app.get('/callback/check/userData', async (req, res) => {
  if (!req.isAuthenticated()) return res.json({ authenticated: false });
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      isAdmin: await isAdminUser(req),
      adminRole: await getAdminRole(req),
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

async function resolvePublicProfile(identifier) {
  const normalizedIdentifier = normalizePublicUsername(identifier);
  if (!/^\d{5,25}$/.test(identifier) && !/^[a-z0-9_.-]{3,32}$/.test(normalizedIdentifier)) {
    const error = new Error('Invalid public profile identifier.');
    error.status = 400;
    error.code = 'invalid_public_profile_identifier';
    throw error;
  }
  const client = getBotClient();
  const databaseReady = mongoose.connection.readyState === 1;
  let profileSettings = null;
  if (databaseReady) {
    const lookup = /^\d{5,25}$/.test(identifier) ? { userId: identifier } : { username: normalizedIdentifier };
    profileSettings = await UserProfile.findOne(lookup).lean();
  }
  const resolvedUserId = profileSettings?.userId || (/^\d{5,25}$/.test(identifier) ? identifier : null);
  let user = resolvedUserId ? await client?.users?.fetch(resolvedUserId) : null;
  if (!user) {
    const needle = normalizedIdentifier;
    user = client?.users?.cache?.find(candidate => [candidate.username, candidate.globalName, candidate.tag].filter(Boolean).some(value => String(value).toLowerCase() === needle)) || null;
  }
  if (!user) {
    const error = new Error('Public profile not found. Set a public username in your profile settings or use the Discord user ID.');
    error.status = 404;
    error.code = 'public_profile_not_found';
    throw error;
  }
  if (databaseReady && !profileSettings) profileSettings = await UserProfile.findOne({ userId: user.id }).lean();
  const publicUsername = profileSettings?.username || user.username;
  const customBanner = profileSettings?.bannerType === 'image' && profileSettings.banner ? profileSettings.banner : null;
  const memberSince = user.createdAt instanceof Date ? user.createdAt.toISOString() : (user.createdTimestamp ? new Date(user.createdTimestamp).toISOString() : null);
  return { success: true, profile: { id: user.id, username: publicUsername, discordUsername: user.username, globalName: user.globalName || user.username, avatar: user.displayAvatarURL({ extension: 'png', size: 256 }), banner: customBanner, accentColor: user.hexAccentColor || null, customStatus: profileSettings?.customStatus || '', memberSince, bot: Boolean(user.bot), publicPath: `/u/${encodeURIComponent(publicUsername)}` }, privacy: { source: 'Discord public profile + saved public username', privateGuildData: false, rawActivity: false } };
}

async function getProfileSocialState(profileUserId, viewerId = null) {
  if (mongoose.connection.readyState !== 1) return { followers: 0, likes: 0, following: false, liked: false };
  const [followers, likes, following, liked] = await Promise.all([
    ProfileFollow.countDocuments({ profileUserId }),
    ProfileLike.countDocuments({ profileUserId }),
    viewerId ? ProfileFollow.exists({ followerId: viewerId, profileUserId }) : null,
    viewerId ? ProfileLike.exists({ likerId: viewerId, profileUserId }) : null
  ]);
  return { followers, likes, following: Boolean(following), liked: Boolean(liked) };
}

async function resolveSocialTarget(identifier) {
  const data = await resolvePublicProfile(String(identifier || '').trim());
  return { ...data, profileUserId: data.profile.id };
}

const profileMutationLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, error: 'profile_action_rate_limited' } });

app.get('/api/public/profile/:identifier', publicStatsLimiter, async (req, res) => {
  try {
    const data = await resolvePublicProfile(String(req.params.identifier || '').trim());
    const social = await getProfileSocialState(data.profile.id, req.isAuthenticated?.() ? req.user.id : null);
    res.json({ ...data, social, viewer: { authenticated: Boolean(req.isAuthenticated?.()) } });
  } catch (error) {
    res.status(error.status || 404).json({ success: false, error: error.code || 'public_profile_not_found', message: error.message });
  }
});

async function servePublicProfileCard(req, res) {
  try {
    const data = await resolveSocialTarget(req.params.identifier);
    const social = await getProfileSocialState(data.profileUserId);
    const card = await renderPublicProfileCard({ ...data.profile, followers: social.followers, likes: social.likes });
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' }).send(card);
  } catch (error) {
    res.status(error.status || 404).json({ success: false, error: error.code || 'public_profile_card_not_found', message: error.message });
  }
}
app.get('/api/public/profile-card/:identifier', publicStatsLimiter, servePublicProfileCard);
app.get('/api/public/profile-card-v2/:identifier', publicStatsLimiter, servePublicProfileCard);
app.get('/api/public/profile-card-v3/:identifier', publicStatsLimiter, servePublicProfileCard);

async function requireSocialDatabase(res) {
  if (mongoose.connection.readyState === 1) return true;
  res.status(503).json({ success: false, error: 'database_unavailable', message: 'Profile actions are temporarily unavailable.' });
  return false;
}

app.put('/api/public/profile/:identifier/follow', isAuthenticated, profileMutationLimiter, async (req, res) => {
  if (!(await requireSocialDatabase(res))) return;
  try {
    const { profileUserId } = await resolveSocialTarget(req.params.identifier);
    if (profileUserId === req.user.id) return res.status(400).json({ success: false, error: 'cannot_follow_self', message: 'You cannot follow your own profile.' });
    await ProfileFollow.updateOne({ followerId: req.user.id, profileUserId }, { $setOnInsert: { followerId: req.user.id, profileUserId, createdAt: new Date() } }, { upsert: true });
    res.json({ success: true, following: true, social: await getProfileSocialState(profileUserId, req.user.id) });
  } catch (error) { res.status(error.status || 404).json({ success: false, error: error.code || 'follow_failed', message: error.message }); }
});

app.delete('/api/public/profile/:identifier/follow', isAuthenticated, profileMutationLimiter, async (req, res) => {
  if (!(await requireSocialDatabase(res))) return;
  try {
    const { profileUserId } = await resolveSocialTarget(req.params.identifier);
    await ProfileFollow.deleteOne({ followerId: req.user.id, profileUserId });
    res.json({ success: true, following: false, social: await getProfileSocialState(profileUserId, req.user.id) });
  } catch (error) { res.status(error.status || 404).json({ success: false, error: error.code || 'unfollow_failed', message: error.message }); }
});

app.put('/api/public/profile/:identifier/like', isAuthenticated, profileMutationLimiter, async (req, res) => {
  if (!(await requireSocialDatabase(res))) return;
  try {
    const { profileUserId } = await resolveSocialTarget(req.params.identifier);
    await ProfileLike.updateOne({ likerId: req.user.id, profileUserId }, { $setOnInsert: { likerId: req.user.id, profileUserId, createdAt: new Date() } }, { upsert: true });
    res.json({ success: true, liked: true, social: await getProfileSocialState(profileUserId, req.user.id) });
  } catch (error) { res.status(error.status || 404).json({ success: false, error: error.code || 'like_failed', message: error.message }); }
});

app.delete('/api/public/profile/:identifier/like', isAuthenticated, profileMutationLimiter, async (req, res) => {
  if (!(await requireSocialDatabase(res))) return;
  try {
    const { profileUserId } = await resolveSocialTarget(req.params.identifier);
    await ProfileLike.deleteOne({ likerId: req.user.id, profileUserId });
    res.json({ success: true, liked: false, social: await getProfileSocialState(profileUserId, req.user.id) });
  } catch (error) { res.status(error.status || 404).json({ success: false, error: error.code || 'unlike_failed', message: error.message }); }
});

app.get('/stats', (req, res) => res.sendFile(path.join(dashDir, 'pages', 'stats.html')));
app.get('/stats/:guildId', (req, res) => res.sendFile(path.join(dashDir, 'pages', 'stats.html')));
const publicProfilePagePath = path.join(dashDir, 'pages', 'profile.html');
const publicProfilePageTemplate = fs.readFileSync(publicProfilePagePath, 'utf8');
const escapeMeta = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));

app.get('/u/:identifier', async (req, res) => {
  const identifier = String(req.params.identifier || '').trim();
  let profile = null;
  let social = { followers: 0, likes: 0 };
  try {
    const data = await resolvePublicProfile(identifier);
    profile = data.profile;
    social = await getProfileSocialState(profile.id);
  } catch (_) {
    return res.status(404).type('html').send('Public profile not found.');
  }
  const username = profile.username;
  const displayName = profile.globalName || username;
  const publicUrl = `${SEO_BASE_URL}/u/${encodeURIComponent(username)}`;
  const cardUrl = `${SEO_BASE_URL}/api/public/profile-card-v3/${encodeURIComponent(username)}`;
  const description = [
    `${displayName} (@${username}) on ProMcBot.`,
    profile.customStatus,
    `${social.likes} like${social.likes === 1 ? '' : 's'}.`,
  ].filter(Boolean).join(' ');
  const title = `${displayName} — ProMcBot Profile`;
  const meta = `
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${escapeMeta(publicUrl)}">
    <meta name="theme-color" content="#1553b8">
    <meta property="og:type" content="profile">
    <meta property="og:site_name" content="ProMcBot">
    <meta property="og:title" content="${escapeMeta(title)}">
    <meta property="og:description" content="${escapeMeta(description)}">
    <meta property="og:url" content="${escapeMeta(publicUrl)}">
    <meta property="og:image" content="${escapeMeta(cardUrl)}">
    <meta property="og:image:secure_url" content="${escapeMeta(cardUrl)}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="1536">
    <meta property="og:image:height" content="1024">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeMeta(title)}">
    <meta name="twitter:description" content="${escapeMeta(description)}">
    <meta name="twitter:image" content="${escapeMeta(cardUrl)}">`;
  const html = publicProfilePageTemplate
    .replace(/<title>[^<]*<\/title>/i, `<title>${escapeMeta(title)}</title>`)
    .replace('</head>', `${meta}\n</head>`);
  res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300').type('html').send(html);
});
app.get('/profile/:identifier', (req, res) => res.redirect(302, `/u/${encodeURIComponent(req.params.identifier)}`));
app.get('/user/:username', (req, res) => res.redirect(302, `/u/${encodeURIComponent(req.params.username)}`));

// Dashboard Protected Pages
app.get('/dashboard', isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'dashboard.html')));
app.get('/myservers', isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'servers.html')));
app.get('/servers', isAuthenticated, (req, res) => res.redirect(302, '/myservers'));
app.get('/intelligence', isAuthenticated, (req, res) => res.redirect(302, '/myservers'));
app.get('/onboarding', isAuthenticated, (req, res) => res.redirect(302, '/myservers'));
app.get('/actions', isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'actions.html')));
app.get('/smart-actions', isAuthenticated, (req, res) => res.sendFile(path.join(dashDir, 'pages', 'smart-actions.html')));
app.get('/premium', isAuthenticated, (req, res) => res.redirect(302, '/myservers'));

// Dynamic Server Pages
const serverPages = ['overview', 'settings', 'moderation', 'roles', 'logs', 'modules', 'welcome', 'premium', 'configuration', 'ticket', 'bugs', 'intelligence', 'actions', 'smart-actions'];
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
    const [intel, plugin, executions] = await Promise.all([
      TelemetryEvent.find({ serverId: req.params.guildId, occurredAt: { $gte: new Date(Date.now() - WINDOW_MS * 2), $lt: new Date() } }).sort({ occurredAt: -1 }).limit(10000).lean().then(summarizeTelemetry),
      PluginInstance.findOne({ serverId: req.params.guildId, revokedAt: null }).sort({ lastSeenAt: -1 }).lean(),
      AutomationExecution.find({ serverId: req.params.guildId }).sort({ executedAt: -1 }).limit(5).lean(),
    ]);
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
      action: { type: 'navigate', href: `/myservers/${encodeURIComponent(req.params.guildId)}/smart-actions`, label: 'Configure a Smart Action' },
    }));
    res.json({
      success: true,
      issues: actions,
      evidence: { confidence: intel.confidence, sample: intel.sample, generatedAt: intel.generatedAt },
      server: { connected: Boolean(plugin), lastSeenAt: plugin?.lastSeenAt || null, status: plugin?.status || 'unknown' },
      recentExecutions: executions.map(item => ({ status: item.status, trigger: item.trigger, executedAt: item.executedAt, preset: item.preset || null })),
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
    let publicBaseUrl;
    try { publicBaseUrl = buildPublicBaseUrl(req); }
    catch (error) { return res.status(503).json({ success: false, error: error.message }); }
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
    res.status(201).json({ success: true, oneTimeConfig: { baseUrl: publicBaseUrl, serverId: req.params.guildId, instanceId, networkId, minecraftServerId, serverName, accessToken, signingSecret, protocolVersion: '1' }, warning: 'Store these credentials in the plugin config.yml. They are not returned again.' });
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

app.get('/api/guilds/:guildId/text-channels', isAuthenticated, requireGuildManager, async (req, res) => {
  const client = global.__botClient;
  const guild = client?.guilds?.cache?.get(req.params.guildId);
  if (!guild) return res.status(503).json({ success: false, error: 'discord_guild_unavailable', message: 'The bot is not currently connected to this server.' });
  const channels = [...guild.channels.cache.values()]
    .filter(channel => !channel.isThread?.() && [0, 5].includes(channel.type) && channel.viewable !== false)
    .sort((left, right) => (Number(left.position || 0) - Number(right.position || 0)) || String(left.name).localeCompare(String(right.name)))
    .map(channel => ({ id: String(channel.id), name: String(channel.name || channel.id), type: channel.type === 5 ? 'announcement' : 'text', category: channel.parent?.name || null }));
  res.json({ success: true, channels });
});

app.get('/api/guilds/:guildId/smart-actions', isAuthenticated, requireGuildManager, async (req, res) => {
  try {
    const state = await getSmartActionState(req.params.guildId);
    res.json({ success: true, actions: state.catalog, entitlement: { plan: state.entitlement.plan, features: state.entitlement.features } });
  } catch (error) { res.status(500).json({ success: false, error: 'smart_actions_unavailable' }); }
});

app.patch('/api/guilds/:guildId/smart-actions/:preset', isAuthenticated, requireGuildManager, async (req, res) => {
  let replacedRule = null;
  try {
    const preset = getSmartActionPreset(req.params.preset);
    if (!preset) return res.status(404).json({ success: false, error: 'smart_action_not_found' });
    const state = await getSmartActionState(req.params.guildId);
    if (!hasFeature(state.entitlement, preset.feature)) return res.status(402).json({ success: false, error: 'feature_requires_entitlement', feature: preset.feature, requiredPlan: requiredPlanFor(preset.feature) });
    const enabled = req.body?.enabled !== false;
    const existing = state.rules.find(rule => rule.preset === preset.key);
    if (!enabled) {
      if (!existing) return res.status(404).json({ success: false, error: 'smart_action_not_enabled' });
      const rule = await AutomationRule.findOneAndUpdate({ _id: existing._id, serverId: req.params.guildId, preset: preset.key }, { $set: { enabled: false } }, { new: true }).lean();
      await recordAudit({ actorId: req.user.id, guildId: req.params.guildId, action: 'smart_action_disabled', feature: preset.feature, result: 'success', source: 'dashboard', target: preset.key });
      return res.json({ success: true, action: { ...preset, enabled: false, status: 'disabled', ruleId: String(rule._id) } });
    }
    const channelId = validateSmartActionChannel(req.body?.channelId || existing?.channelId);
    if (!channelId) return res.status(400).json({ success: false, error: 'valid_discord_channel_id_required' });
    const discordGuild = global.__botClient?.guilds?.cache?.get(req.params.guildId);
    const selectedChannel = discordGuild?.channels?.cache?.get(channelId);
    if (!selectedChannel || selectedChannel.isThread?.() || ![0, 5].includes(selectedChannel.type) || selectedChannel.viewable === false) {
      return res.status(400).json({ success: false, error: 'text_channel_not_found', message: 'Choose a visible text room from this server.' });
    }
    let replacedAction = null;
    if (!existing?.enabled) {
      const enabledActions = state.rules
        .filter(rule => rule.enabled && rule.preset)
        .sort((left, right) => new Date(left.updatedAt || left.createdAt || 0) - new Date(right.updatedAt || right.createdAt || 0));
      if (enabledActions.length >= 3) {
        const oldest = enabledActions[0];
        replacedRule = oldest;
        await AutomationRule.updateOne({ _id: oldest._id, serverId: req.params.guildId }, { $set: { enabled: false } });
        replacedAction = oldest.preset;
      }
    }
    // AutomationRule enforces a minimum cooldown of 60 minutes for every preset.
    // Using 10 minutes here caused ValidationError for the first three Smart Actions.
    const ruleData = { name: preset.name, enabled: true, trigger: preset.trigger, action: 'discord_message', channelId, messageTemplate: preset.defaultMessage, cooldownMinutes: preset.trigger === 'weekly_summary' ? 10080 : 60, thresholdPercent: -5, thresholdPlayers: preset.trigger === 'player_count_high' ? 10 : 1 };
    const rule = existing
      ? await AutomationRule.findOneAndUpdate({ _id: existing._id, serverId: req.params.guildId, preset: preset.key }, { $set: ruleData }, { new: true, runValidators: true }).lean()
      : await AutomationRule.create({ ...ruleData, serverId: req.params.guildId, preset: preset.key, createdBy: req.user.id, thresholdPercent: -5, thresholdPlayers: ruleData.thresholdPlayers });
    if (!rule) return res.status(409).json({ success: false, error: 'smart_action_save_conflict' });
    await recordAudit({ actorId: req.user.id, guildId: req.params.guildId, action: existing ? 'smart_action_enabled' : 'smart_action_created', feature: preset.feature, result: 'success', source: 'dashboard', target: preset.key, metadata: { channelId } }).catch(error => console.error('[smart action audit] failed:', error.message));
    res.json({ success: true, action: { ...preset, enabled: true, status: 'enabled', ruleId: String(rule._id), channelId }, replacedAction });
  } catch (error) {
    if (replacedRule) await AutomationRule.updateOne({ _id: replacedRule._id, serverId: req.params.guildId }, { $set: { enabled: true } }).catch(restoreError => console.error('[smart action restore] failed:', restoreError.message));
    console.error('[smart action update] failed:', error.message);
    res.status(400).json({ success: false, error: 'smart_action_update_failed', message: error.name === 'ValidationError' ? 'The Smart Action data is invalid.' : 'The Smart Action could not be saved. Please try again.' });
  }
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
