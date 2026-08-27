'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function eventOnlinePlayers(event) {
  return numeric(event?.data?.onlinePlayers ?? event?.payload?.onlinePlayers);
}

function buildPublicStats(events = [], plugin = null, now = Date.now()) {
  const cutoff = now - DAY_MS;
  const recent = events
    .map(event => ({ ...event, occurredAt: toDate(event?.occurredAt) }))
    .filter(event => event.occurredAt && event.occurredAt.getTime() >= cutoff && event.occurredAt.getTime() <= now)
    .sort((a, b) => a.occurredAt - b.occurredAt);

  const counts = { joins: 0, leaves: 0 };
  let latestOnlinePlayers = null;
  let latestAt = null;
  for (const event of recent) {
    if (event.type === 'player_join') counts.joins += 1;
    if (event.type === 'player_leave') counts.leaves += 1;
    if (event.type === 'player_count' || event.type === 'heartbeat') {
      const onlinePlayers = eventOnlinePlayers(event);
      if (onlinePlayers !== null) {
        latestOnlinePlayers = onlinePlayers;
        latestAt = event.occurredAt;
      }
    }
  }

  const pluginLastSeen = toDate(plugin?.lastSeenAt);
  const pluginOnline = Boolean(pluginLastSeen && pluginLastSeen.getTime() >= now - 15 * 60 * 1000);
  if (latestOnlinePlayers === null) latestOnlinePlayers = numeric(plugin?.lastOnlinePlayers);

  return {
    window: '24h',
    measured: recent.length > 0,
    eventCount: recent.length,
    playerJoins: counts.joins,
    playerLeaves: counts.leaves,
    latestOnlinePlayers,
    latestMeasuredAt: latestAt ? latestAt.toISOString() : null,
    plugin: {
      connected: Boolean(plugin),
      online: pluginOnline,
      lastSeenAt: pluginLastSeen ? pluginLastSeen.toISOString() : null,
    },
    privacy: {
      public: true,
      excludesPlayerNames: true,
      excludesDiscordMembers: true,
      excludesRawTelemetry: true,
    },
  };
}

module.exports = { DAY_MS, buildPublicStats };
