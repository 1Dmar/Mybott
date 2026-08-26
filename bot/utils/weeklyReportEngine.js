const Report = require('../Models/Report');
const TelemetryEvent = require('../Models/TelemetryEvent');
const { summarizeTelemetry, WINDOW_MS } = require('./intelligenceEngine');
const { analyzePlayers } = require('./playerIntelligenceEngine');

function startOfUtcWeek(date = new Date()) {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  const day = value.getUTCDay();
  value.setUTCDate(value.getUTCDate() - day);
  return value;
}

async function generateWeeklyReport(guildId, plan = 'free', now = new Date()) {
  const periodStart = startOfUtcWeek(now);
  const periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const events = await TelemetryEvent.find({ serverId: guildId, occurredAt: { $gte: new Date(now.getTime() - WINDOW_MS * 2), $lt: now } }).sort({ occurredAt: -1 }).limit(50000).lean();
  const server = summarizeTelemetry(events, now.getTime());
  const players = analyzePlayers(events, now.getTime());
  const activity = server.analysis.find(item => item.key === 'activity_trend');
  const report = {
    title: 'ProMcBot Weekly Intelligence',
    status: server.confidence === 'insufficient' ? 'not_enough_data' : 'ready',
    message: server.confidence === 'insufficient' ? 'Not enough data yet.' : null,
    serverHealth: null,
    playersAnalyzed: players.sample.players,
    returningPlayers: players.retention.returnedWithinSevenDays,
    retention: players.retention,
    activityTrend: activity || null,
    topProblem: activity?.changePercent < -5 ? 'Server activity decline' : null,
    biggestOpportunity: activity?.changePercent > 5 ? 'Build on the observed activity increase' : players.retention.returnRate !== null && players.retention.returnRate < 30 ? 'New-player return behavior' : null,
    recommendedAction: activity?.changePercent < -5 ? 'Review new-player retention and weekend engagement.' : null,
    evidence: { server: server.sample, players: players.sample },
  };
  return Report.findOneAndUpdate({ guildId, type: 'weekly_intelligence', periodStart }, { guildId, type: 'weekly_intelligence', periodStart, periodEnd, generatedAt: now, planAtGeneration: plan, report, expiresAt: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000) }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
}

module.exports = { startOfUtcWeek, generateWeeklyReport };
