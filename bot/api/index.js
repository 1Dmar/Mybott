const express = require('express');
const ServerInfo = require('../Models/Server');
const TelemetryEvent = require('../Models/TelemetryEvent');
const PluginInstance = require('../Models/PluginInstance');
const { getForGuild } = require('../utils/entitlementService');
const { hasFeature } = require('../utils/entitlements');
const { summarizeTelemetry, WINDOW_MS } = require('../utils/intelligenceEngine');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ success: true, message: 'ProMcBot API is active.', endpoints: { status: 'GET /bot/status', player: 'GET /bot/player/:ign', intelligence: 'GET /bot/intelligence', command: 'POST /bot/command' } });
});

router.use(async (req, res, next) => {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'bearer_token_required' });
  const bearerToken = authHeader.slice(7);
  try {
    const serverConfig = await ServerInfo.findOne({ apiToken: { $in: [bearerToken, `Bearer ${bearerToken}`] } }).lean();
    if (!serverConfig) return res.status(403).json({ success: false, error: 'server_token_not_registered' });
    const entitlement = await getForGuild(serverConfig.serverId);
    req.serverConfig = serverConfig;
    req.entitlement = entitlement;
    next();
  } catch (error) {
    console.error('[bot api auth] error:', error.message);
    res.status(500).json({ success: false, error: 'authorization_failed' });
  }
});

router.get('/status', async (req, res) => {
  const [instance, latest] = await Promise.all([
    PluginInstance.findOne({ serverId: req.serverConfig.serverId }).sort({ lastSeenAt: -1 }).lean(),
    TelemetryEvent.findOne({ serverId: req.serverConfig.serverId, type: 'player_count' }).sort({ occurredAt: -1 }).lean(),
  ]);
  res.json({ success: true, serverId: req.serverConfig.serverId, serverName: req.serverConfig.serverName || null, plan: req.entitlement.plan, server: { connected: !!instance, status: instance?.status || 'offline', instanceId: instance?.instanceId || null, lastSeenAt: instance?.lastSeenAt || null, onlinePlayers: latest?.data?.onlinePlayers ?? null }, evidence: { latestPlayerCountAt: latest?.occurredAt || null } });
});

router.get('/player/:ign', async (req, res) => {
  const ign = String(req.params.ign || '').trim().slice(0, 32);
  if (!/^[A-Za-z0-9_]{1,32}$/.test(ign)) return res.status(400).json({ success: false, error: 'invalid_player_name' });
  const events = await TelemetryEvent.find({ serverId: req.serverConfig.serverId, type: { $in: ['player_join', 'player_leave'] }, $or: [{ 'data.username': ign }, { 'data.uuid': ign }] }).sort({ occurredAt: -1 }).limit(100).lean();
  const sessionDurations = events.filter(event => event.type === 'player_leave' && Number.isFinite(Number(event.data?.sessionSeconds))).map(event => Number(event.data.sessionSeconds));
  res.json({ success: true, player: ign, found: events.length > 0, observedEvents: events.length, lastSeenAt: events[0]?.occurredAt || null, sessionCount: sessionDurations.length, totalObservedSessionSeconds: sessionDurations.reduce((sum, seconds) => sum + seconds, 0), evidence: events.slice(0, 20).map(event => ({ type: event.type, occurredAt: event.occurredAt, sessionSeconds: event.data?.sessionSeconds ?? null })) });
});

router.get('/intelligence', async (req, res) => {
  if (!hasFeature(req.entitlement, 'server.intelligence.advanced')) return res.status(402).json({ success: false, error: 'feature_requires_pro', feature: 'server.intelligence.advanced', entitlement: { plan: req.entitlement.plan, requiredPlan: 'pro' }, message: 'This intelligence report requires Pro. Basic server status remains available.' });
  const events = await TelemetryEvent.find({ serverId: req.serverConfig.serverId, occurredAt: { $gte: new Date(Date.now() - WINDOW_MS * 2), $lt: new Date() } }).sort({ occurredAt: -1 }).limit(10000).lean();
  res.json({ success: true, intelligence: summarizeTelemetry(events) });
});

router.post('/command', (req, res) => {
  res.status(501).json({ success: false, error: 'minecraft_command_channel_not_implemented', message: 'No destructive Minecraft action is exposed until an explicit, permissioned control channel is implemented.' });
});

module.exports = router;
