const DAY_MS = 24 * 60 * 60 * 1000;

function eventTime(event) {
  const value = new Date(event.occurredAt).getTime();
  return Number.isFinite(value) ? value : null;
}

function round(value) { return value === null || value === undefined ? null : Number(value.toFixed(2)); }

function analyzePlayers(events, now = Date.now()) {
  const players = new Map();
  for (const event of events) {
    const uuid = String(event.data?.uuid || '').trim();
    const timestamp = eventTime(event);
    if (!uuid || timestamp === null) continue;
    const player = players.get(uuid) || { uuid, username: event.data?.username || null, joins: [], leaves: [], sessionSeconds: 0 };
    if (event.type === 'player_join') player.joins.push(timestamp);
    if (event.type === 'player_leave') { player.leaves.push(timestamp); const duration = Number(event.data?.sessionSeconds); if (Number.isFinite(duration) && duration >= 0) player.sessionSeconds += duration; }
    if (event.data?.username) player.username = String(event.data.username).slice(0, 32);
    players.set(uuid, player);
  }
  const recentStart = now - 7 * DAY_MS;
  const previousStart = now - 14 * DAY_MS;
  const profiles = [...players.values()].map(player => {
    const joins = player.joins.sort((a, b) => a - b);
    const firstSeen = joins[0] || player.leaves.sort((a, b) => a - b)[0] || null;
    const lastSeen = Math.max(...joins, ...player.leaves, 0);
    const recentJoins = joins.filter(time => time >= recentStart && time < now);
    const previousJoins = joins.filter(time => time >= previousStart && time < recentStart);
    const activeDays = new Set(joins.filter(time => time >= now - 30 * DAY_MS).map(time => new Date(time).toISOString().slice(0, 10))).size;
    const returnedWithinSevenDays = joins.some((time, index) => index > 0 && time - joins[index - 1] >= DAY_MS && time - joins[index - 1] <= 7 * DAY_MS);
    let segment = 'new';
    if (lastSeen < now - 30 * DAY_MS) segment = 'inactive';
    else if (lastSeen < now - 14 * DAY_MS) segment = 'declining';
    else if (joins.length >= 5 && activeDays >= 3) segment = 'loyal';
    else if (joins.length >= 3 && recentJoins.length > 0) segment = 'active';
    else if (joins.length >= 2) segment = 'returning';
    return { uuid: player.uuid, username: player.username, firstSeen: firstSeen ? new Date(firstSeen).toISOString() : null, lastSeen: lastSeen ? new Date(lastSeen).toISOString() : null, sessions: joins.length, sessionSeconds: player.sessionSeconds, frequency30d: activeDays, recentJoins: recentJoins.length, previousJoins: previousJoins.length, returnedWithinSevenDays, segment };
  });
  const recentNew = profiles.filter(profile => profile.firstSeen && new Date(profile.firstSeen).getTime() >= recentStart && new Date(profile.firstSeen).getTime() < now);
  const returned = recentNew.filter(profile => profile.returnedWithinSevenDays);
  const cohortBase = profiles.filter(profile => profile.firstSeen && new Date(profile.firstSeen).getTime() >= now - 14 * DAY_MS && new Date(profile.firstSeen).getTime() < recentStart);
  const cohortRetained = cohortBase.filter(profile => profile.recentJoins > 0);
  const enough = profiles.length >= 3;
  return {
    generatedAt: new Date(now).toISOString(),
    confidence: profiles.length >= 20 ? 'high' : profiles.length >= 3 ? 'medium' : 'insufficient',
    message: enough ? null : 'Not enough data yet.',
    sample: { players: profiles.length, newPlayers7d: recentNew.length, cohortPlayers7to14d: cohortBase.length, observedEvents: events.length },
    journey: { new: profiles.filter(p => p.segment === 'new').length, returning: profiles.filter(p => p.segment === 'returning').length, active: profiles.filter(p => p.segment === 'active').length, loyal: profiles.filter(p => p.segment === 'loyal').length, declining: profiles.filter(p => p.segment === 'declining').length, inactive: profiles.filter(p => p.segment === 'inactive').length },
    retention: { newPlayers7d: recentNew.length, returnedWithinSevenDays: returned.length, returnRate: recentNew.length ? round(returned.length / recentNew.length * 100) : null, cohortPlayers7to14d: cohortBase.length, retainedAfterSevenDays: cohortRetained.length, sevenDayRetention: cohortBase.length ? round(cohortRetained.length / cohortBase.length * 100) : null },
    players: profiles.sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || '')).slice(0, 500),
  };
}

module.exports = { DAY_MS, analyzePlayers };
