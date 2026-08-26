const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function inWindow(date, start, end) {
  const time = new Date(date).getTime();
  return Number.isFinite(time) && time >= start && time < end;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function percentChange(current, previous) {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function summarizeTelemetry(events, now = Date.now()) {
  const recentStart = now - WINDOW_MS;
  const previousStart = now - WINDOW_MS * 2;
  const recent = events.filter(event => inWindow(event.occurredAt, recentStart, now));
  const previous = events.filter(event => inWindow(event.occurredAt, previousStart, recentStart));
  const recentCounts = recent.filter(event => event.type === 'player_count').map(event => numeric(event.data?.onlinePlayers)).filter(value => value !== null);
  const previousCounts = previous.filter(event => event.type === 'player_count').map(event => numeric(event.data?.onlinePlayers)).filter(value => value !== null);
  const recentSession = recent.filter(event => event.type === 'player_leave').map(event => numeric(event.data?.sessionSeconds)).filter(value => value !== null && value >= 0);
  const previousSession = previous.filter(event => event.type === 'player_leave').map(event => numeric(event.data?.sessionSeconds)).filter(value => value !== null && value >= 0);
  const recentAverage = average(recentCounts);
  const previousAverage = average(previousCounts);
  const recentSessionAverage = average(recentSession);
  const previousSessionAverage = average(previousSession);
  const activityChange = percentChange(recentAverage, previousAverage);
  const sessionChange = percentChange(recentSessionAverage, previousSessionAverage);
  const recentJoins = recent.filter(event => event.type === 'player_join');
  const previousJoins = previous.filter(event => event.type === 'player_join');
  const recentUnique = new Set(recentJoins.map(event => String(event.data?.uuid || '')).filter(Boolean));
  const previousUnique = new Set(previousJoins.map(event => String(event.data?.uuid || '')).filter(Boolean));
  const returningPlayers = [...recentUnique].filter(uuid => previousUnique.has(uuid)).length;
  const confidence = recent.length >= 10 && previous.length >= 10 ? 'high' : recent.length >= 3 && previous.length >= 3 ? 'medium' : 'insufficient';

  const result = {
    generatedAt: new Date(now).toISOString(),
    windows: { recentStart: new Date(recentStart).toISOString(), previousStart: new Date(previousStart).toISOString(), end: new Date(now).toISOString() },
    confidence,
    sample: { recentEvents: recent.length, previousEvents: previous.length, recentPlayerCountPoints: recentCounts.length, previousPlayerCountPoints: previousCounts.length, recentSessions: recentSession.length, previousSessions: previousSession.length },
    observations: [],
    analysis: [],
    recommendations: [],
  };

  if (recentAverage !== null) result.observations.push({ key: 'average_online_players', value: Number(recentAverage.toFixed(2)), evidence: `Based on ${recentCounts.length} player_count observations in the recent window.` });
  if (previousAverage !== null) result.observations.push({ key: 'previous_average_online_players', value: Number(previousAverage.toFixed(2)), evidence: `Based on ${previousCounts.length} player_count observations in the comparison window.` });
  if (returningPlayers > 0) result.observations.push({ key: 'returning_players', value: returningPlayers, evidence: 'UUIDs observed in both comparison windows.' });
  if (recentSessionAverage !== null) result.observations.push({ key: 'average_session_seconds', value: Number(recentSessionAverage.toFixed(2)), evidence: `Based on ${recentSession.length} player_leave events.` });

  if (activityChange !== null && confidence !== 'insufficient') {
    result.analysis.push({ key: 'activity_trend', changePercent: Number(activityChange.toFixed(2)), interpretation: activityChange < -5 ? 'Activity declined in the recent window.' : activityChange > 5 ? 'Activity increased in the recent window.' : 'Activity was broadly stable in the recent window.', evidence: 'Comparison of average online-player observations across two equal windows.' });
    if (activityChange < -5) result.recommendations.push({ what: 'Review recent player activity and onboarding', why: 'Average online-player activity declined beyond the 5% evidence threshold.', action: 'Open the intelligence details and inspect player-count observations before launching an intervention.' });
  }
  if (sessionChange !== null && confidence !== 'insufficient') {
    result.analysis.push({ key: 'session_duration_trend', changePercent: Number(sessionChange.toFixed(2)), interpretation: sessionChange < -5 ? 'Average observed session duration declined.' : sessionChange > 5 ? 'Average observed session duration increased.' : 'Average observed session duration was broadly stable.', evidence: 'Comparison of durations from recorded player_leave events.' });
  }
  if (recentUnique.size > 0) {
    result.analysis.push({ key: 'returning_player_signal', returningPlayers, recentJoinedPlayers: recentUnique.size, interpretation: 'Returning-player count is an observed overlap, not a prediction.' });
  }
  if (confidence === 'insufficient') {
    result.analysis.push({ key: 'insufficient_data', interpretation: 'There are not enough telemetry events in both comparison windows for a reliable trend.' });
  }
  return result;
}

module.exports = { WINDOW_MS, summarizeTelemetry };
