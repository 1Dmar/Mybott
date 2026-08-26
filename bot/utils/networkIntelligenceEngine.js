function summarizeNetwork(instances, events, now = Date.now()) {
  const byInstance = new Map(instances.map(instance => [String(instance.instanceId), { instanceId: String(instance.instanceId), serverName: instance.serverName || instance.minecraftServerId || instance.instanceId, networkId: instance.networkId || null, status: instance.status || 'offline', lastSeenAt: instance.lastSeenAt || null, counts: [] }]));
  for (const event of events) {
    const item = byInstance.get(String(event.instanceId));
    if (!item || event.type !== 'player_count') continue;
    const value = Number(event.data?.onlinePlayers);
    const time = new Date(event.occurredAt).getTime();
    if (Number.isFinite(value) && Number.isFinite(time) && time >= now - 14 * 24 * 60 * 60 * 1000 && time < now) item.counts.push({ value, time });
  }
  const servers = [...byInstance.values()].map(item => {
    const average = item.counts.length ? item.counts.reduce((sum, point) => sum + point.value, 0) / item.counts.length : null;
    const latest = item.counts.sort((a, b) => b.time - a.time)[0];
    return { instanceId: item.instanceId, serverName: item.serverName, networkId: item.networkId, status: item.status, lastSeenAt: item.lastSeenAt, observations: item.counts.length, averageOnlinePlayers: average === null ? null : Number(average.toFixed(2)), latestOnlinePlayers: latest?.value ?? null };
  });
  const measured = servers.filter(server => server.averageOnlinePlayers !== null);
  const totalAverage = measured.length ? measured.reduce((sum, server) => sum + server.averageOnlinePlayers, 0) : null;
  const top = measured.slice().sort((a, b) => b.averageOnlinePlayers - a.averageOnlinePlayers)[0] || null;
  const weakest = measured.slice().sort((a, b) => a.averageOnlinePlayers - b.averageOnlinePlayers)[0] || null;
  const networkHealth = servers.length ? Math.round(servers.reduce((sum, server) => sum + (server.status === 'online' ? 100 : server.status === 'degraded' ? 60 : 0), 0) / servers.length) : null;
  return { generatedAt: new Date(now).toISOString(), confidence: measured.length >= 2 ? 'medium' : measured.length === 1 ? 'low' : 'insufficient', message: measured.length ? null : 'Not enough data yet.', networkHealth, serverCount: servers.length, measuredServerCount: measured.length, totalAverageOnlinePlayers: totalAverage === null ? null : Number(totalAverage.toFixed(2)), topPerformingServer: top, weakestPerformingServer: weakest, servers };
}

module.exports = { summarizeNetwork };
