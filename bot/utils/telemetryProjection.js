'use strict';

function latestOnlinePlayers(events) {
  const list = Array.isArray(events) ? events : [];
  const value = list
    .map(event => ['player_count', 'heartbeat'].includes(event?.type) ? Number(event?.data?.onlinePlayers) : NaN)
    .find(Number.isFinite);
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

module.exports = { latestOnlinePlayers };
