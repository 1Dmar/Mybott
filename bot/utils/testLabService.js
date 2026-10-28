'use strict';

const crypto = require('crypto');
const net = require('net');
const TestLabSession = require('../Models/TestLabSession');
const PluginInstance = require('../Models/PluginInstance');

const activeRunners = new Map();
const BOT_CONNECT_STAGGER_MS = 2000;

function cleanText(value, max = 240) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function validateHost(value) {
  const host = cleanText(value, 255).toLowerCase();
  if (!host || host.includes('/') || host.includes(':') || host.includes('\\') || host.includes(' ')) return null;
  if (host === '169.254.169.254' || host === 'metadata.google.internal') return null;
  if (net.isIP(host) === 4 && host.startsWith('0.')) return null;
  return host;
}

function normalizeConfig(body = {}) {
  const host = validateHost(body.host || body.ip);
  if (!host) throw new Error('invalid_minecraft_host');
  const port = Math.round(Number(body.port || 25565));
  const requestedBots = Math.round(Number(body.requestedBots ?? body.botCount ?? 1));
  const durationMinutes = Math.round(Number(body.durationMinutes ?? body.duration ?? 10));
  const chatIntervalSeconds = Math.round(Number(body.chatIntervalSeconds ?? 30));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid_minecraft_port');
  if (!Number.isInteger(requestedBots) || requestedBots < 1 || requestedBots > 25) throw new Error('bot_count_must_be_between_1_and_25');
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 120) throw new Error('duration_must_be_between_1_and_120_minutes');
  if (!Number.isInteger(chatIntervalSeconds) || chatIntervalSeconds < 5 || chatIntervalSeconds > 600) throw new Error('chat_interval_must_be_between_5_and_600_seconds');
  const chatScript = (Array.isArray(body.chatScript) ? body.chatScript : String(body.chatScript || '').split('\n'))
    .map(line => cleanText(line, 240)).filter(Boolean).slice(0, 25);
  return { host, port, requestedBots, durationMinutes, chatIntervalSeconds, chatScript };
}

function botUsername(index) {
  return `PMC_Test_${String(index).padStart(2, '0')}`.slice(0, 16);
}

function getMineflayer() {
  try { return require('mineflayer'); } catch (_) { throw new Error('mineflayer_not_installed'); }
}

function describeBotError(error, username) {
  const technical = cleanText(error?.message || error, 500);
  if (/invalid session|failed to verify username|session server/i.test(technical)) {
    return `Test Lab requires an offline-mode Minecraft server. ${username} was rejected by online authentication (invalid session).`;
  }
  return technical || 'minecraft_bot_connection_failed';
}

async function touchTestPlugin(session, onlinePlayers = 0, status = 'online') {
  await PluginInstance.findOneAndUpdate(
    { serverId: session.serverId, instanceId: session.instanceId },
    { $set: { serverId: session.serverId, instanceId: session.instanceId, protocolVersion: 'test-lab-v1', pluginVersion: 'test-lab', serverName: `Test Lab · ${session.host}:${session.port}`, lastSeenAt: new Date(), lastOnlinePlayers: onlinePlayers, status, revokedAt: null }, $setOnInsert: { firstSeenAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function updateBot(sessionId, username, patch) {
  await TestLabSession.updateOne({ _id: sessionId, 'bots.username': username }, { $set: Object.fromEntries(Object.entries(patch).map(([key, value]) => [`bots.$.${key}`, value])) });
  const session = await TestLabSession.findById(sessionId).select('bots').lean();
  const botsConnected = (session?.bots || []).filter(bot => bot.status === 'online').length;
  await TestLabSession.updateOne({ _id: sessionId }, { $set: { botsConnected } });
}

function createBotRunner(session) {
  const mineflayer = getMineflayer();
  const bots = new Map();
  const timers = new Set();
  let stopped = false;
  let chatIndex = 0;

  const schedule = (fn, delay) => { const timer = setTimeout(() => { timers.delete(timer); fn(); }, delay); timers.add(timer); return timer; };
  const scheduleInterval = (fn, delay) => { const timer = setInterval(fn, delay); timers.add(timer); return timer; };
  const stop = async (reason = 'stopped') => {
    if (stopped) return;
    stopped = true;
    for (const timer of timers) clearTimeout(timer), clearInterval(timer);
    for (const bot of bots.values()) { try { bot.quit(`Test Lab ${reason}`); } catch (_) {} }
    await TestLabSession.updateOne({ _id: session._id }, { $set: { status: reason === 'completed' ? 'completed' : 'stopped', stoppedAt: new Date() } });
    await PluginInstance.updateOne({ serverId: session.serverId, instanceId: session.instanceId }, { $set: { status: 'offline', lastSeenAt: new Date(), lastOnlinePlayers: 0 } });
    activeRunners.delete(String(session._id));
  };

  const emitCount = () => touchTestPlugin(session, [...bots.values()].filter(bot => bot.player).length).catch(() => null);
  const sendScriptLine = () => {
    if (stopped || !session.chatScript.length) return;
    const message = session.chatScript[chatIndex++ % session.chatScript.length];
    for (const bot of bots.values()) { try { if (bot.player) bot.chat(message); } catch (_) {} }
  };

  const connectBot = (index) => {
    if (stopped) return;
    const username = botUsername(index);
    void updateBot(session._id, username, { status: 'connecting', lastError: null });
    try {
      const bot = mineflayer.createBot({ host: session.host, port: session.port, username, auth: 'offline', version: false, hideErrors: true });
      bots.set(username, bot);
      bot.once('spawn', async () => { await updateBot(session._id, username, { status: 'online', joinedAt: new Date(), lastError: null }); await emitCount(); });
      bot.on('end', async () => { await updateBot(session._id, username, { status: 'offline', leftAt: new Date() }); await emitCount(); });
      bot.on('error', async error => {
        const message = describeBotError(error, username);
        await updateBot(session._id, username, { status: 'error', lastError: message });
        await TestLabSession.updateOne({ _id: session._id }, { $set: { lastError: message } });
      });
    } catch (error) {
      const message = describeBotError(error, username);
      void updateBot(session._id, username, { status: 'error', lastError: message });
      void TestLabSession.updateOne({ _id: session._id }, { $set: { lastError: message } });
    }
  };

  // Do not open 25 handshakes in the same tick: that can starve a small test
  // server and turn a useful test into a 300+ tick catch-up storm.
  for (let index = 1; index <= session.requestedBots; index += 1) schedule(() => connectBot(index), (index - 1) * BOT_CONNECT_STAGGER_MS);
  scheduleInterval(sendScriptLine, session.chatIntervalSeconds * 1000);
  schedule(sendScriptLine, 3000);
  schedule(() => stop('completed'), session.durationMinutes * 60 * 1000);
  return { stop };
}

async function startSession(session) {
  const key = String(session._id);
  if (activeRunners.has(key)) return activeRunners.get(key);
  await touchTestPlugin(session, 0, 'online');
  await TestLabSession.updateOne({ _id: session._id }, { $set: { status: 'running', startedAt: session.startedAt || new Date(), endsAt: session.endsAt || new Date(Date.now() + session.durationMinutes * 60 * 1000) } });
  const runner = createBotRunner(session);
  activeRunners.set(key, runner);
  return runner;
}

async function stopSession(id) {
  const runner = activeRunners.get(String(id));
  if (runner) return runner.stop('stopped');
  await TestLabSession.updateOne({ _id: id, status: { $in: ['starting', 'running'] } }, { $set: { status: 'stopped', stoppedAt: new Date() } });
}

function activeSession(id) { return activeRunners.get(String(id)) || null; }

module.exports = { normalizeConfig, startSession, stopSession, activeSession, touchTestPlugin };
