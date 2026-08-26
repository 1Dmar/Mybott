const TelemetryEvent = require('../Models/TelemetryEvent');
const PluginInstance = require('../Models/PluginInstance');
const { summarizeTelemetry, WINDOW_MS } = require('./intelligenceEngine');
const { analyzePlayers } = require('./playerIntelligenceEngine');
const { summarizeNetwork } = require('./networkIntelligenceEngine');
const { getForGuild } = require('./entitlementService');

async function serverIntelligence(guildId, days = 14) {
  const events = await TelemetryEvent.find({ serverId: guildId, occurredAt: { $gte: new Date(Date.now() - Math.min(days, 365) * 24 * 60 * 60 * 1000), $lt: new Date() } }).sort({ occurredAt: -1 }).limit(50000).lean();
  return { events, summary: summarizeTelemetry(events) };
}

async function playerIntelligence(guildId, days = 14) {
  const events = await TelemetryEvent.find({ serverId: guildId, occurredAt: { $gte: new Date(Date.now() - Math.min(days, 365) * 24 * 60 * 60 * 1000), $lt: new Date() }, type: { $in: ['player_join', 'player_leave'] } }).sort({ occurredAt: -1 }).limit(50000).lean();
  return { events, summary: analyzePlayers(events) };
}

async function networkIntelligence(guildId) {
  const [instances, events] = await Promise.all([PluginInstance.find({ serverId: guildId }).lean(), TelemetryEvent.find({ serverId: guildId, occurredAt: { $gte: new Date(Date.now() - WINDOW_MS * 2), $lt: new Date() }, type: 'player_count' }).limit(50000).lean()]);
  return summarizeNetwork(instances, events);
}

module.exports = { serverIntelligence, playerIntelligence, networkIntelligence, getForGuild };
