const { EmbedBuilder } = require('discord.js');

const COLORS = Object.freeze({
  brand: 0xEE3C37,
  success: 0x35C48A,
  error: 0xF05D5E,
  warning: 0xF2A93B,
  info: 0x49B7D8,
  intelligence: 0x9B6CFF,
  system: 0xD9DEE8,
  neutral: 0x596273,
});

const LABEL = '✦ PROMCBOT';
const FOOTER = 'ProMcBot Engine';

function safe(value, fallback = '—') {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

function field(name, value, inline = true) {
  return { name: String(name).toUpperCase(), value: safe(value), inline };
}

function timestamp(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safe(value);
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

function base({ title, eyebrow, description, color = COLORS.brand, footer = FOOTER, timestamp: withTimestamp = true }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: LABEL })
    .setTitle(title)
    .setFooter({ text: footer });
  if (eyebrow) embed.setDescription(`**${eyebrow.toUpperCase()}**${description ? `\n${description}` : ''}`);
  else if (description) embed.setDescription(description);
  if (withTimestamp) embed.setTimestamp();
  return embed;
}

function statusLine(label, value) {
  return `**${String(label).toUpperCase()}**\n${safe(value)}`;
}

function stateColor(state) {
  return {
    healthy: COLORS.success,
    online: COLORS.success,
    degraded: COLORS.warning,
    stale: COLORS.warning,
    offline: COLORS.error,
    unknown: COLORS.system,
  }[state] || COLORS.neutral;
}

function serverHealth({ instance, playerCount, now = Date.now() }) {
  const lastSeen = instance?.lastSeenAt ? new Date(instance.lastSeenAt) : null;
  const ageMinutes = lastSeen && !Number.isNaN(lastSeen.getTime()) ? Math.max(0, Math.round((now - lastSeen.getTime()) / 60000)) : null;
  const explicitStatus = String(instance?.status || '').toLowerCase();
  const state = explicitStatus === 'offline'
    ? 'offline'
    : !instance
      ? 'unknown'
      : ageMinutes !== null && ageMinutes <= 5
        ? 'healthy'
        : ageMinutes !== null && ageMinutes <= 15
          ? 'degraded'
          : 'stale';
  const stateLabel = { healthy: '● HEALTHY', degraded: '● DEGRADED', stale: '● STALE / REVIEW', offline: '● OFFLINE', unknown: '● UNKNOWN' }[state];
  const players = playerCount?.data?.onlinePlayers;
  const latency = playerCount?.data?.latency ?? instance?.latency ?? instance?.latencyMs;
  const version = playerCount?.data?.version ?? instance?.version ?? instance?.minecraftVersion;
  const embed = base({
    title: 'Server Health',
    eyebrow: stateLabel,
    description: 'Measured Minecraft connection and telemetry status.',
    color: stateColor(state),
    footer: 'ProMcBot Telemetry • Live data only',
  });
  embed.addFields(
    field('Connection', state === 'healthy' ? 'Connected' : state === 'unknown' ? 'Not connected' : state === 'offline' ? 'Offline' : 'Needs review'),
    field('Instance', instance?.instanceId || 'Not identified'),
    field('Players', players === undefined ? 'Not measured' : `${players} online`),
    field('Latency', latency === undefined ? 'Not measured' : `${latency}ms`),
    field('Minecraft', version || 'Not reported'),
    field('Last heartbeat', timestamp(instance?.lastSeenAt), false),
  );
  return embed;
}

function intelligence({ summary }) {
  const confidence = String(summary?.confidence || 'insufficient').toLowerCase();
  const color = confidence === 'high' || confidence === 'medium' ? COLORS.intelligence : COLORS.neutral;
  const analysis = summary?.analysis?.length
    ? summary.analysis.slice(0, 3).map(item => `${item.label}: ${item.changePercent === null ? 'not measurable' : `${item.changePercent}%`}`).join('\n')
    : 'No measured trend yet.';
  const embed = base({
    title: 'Weekly Analysis',
    eyebrow: 'INTELLIGENCE',
    description: summary?.message || 'Evidence-backed observations from received telemetry.',
    color,
    footer: `ProMcBot Intelligence • ${confidence.toUpperCase()} CONFIDENCE`,
  });
  embed.addFields(
    field('Observed events', summary?.sample?.events ?? 0),
    field('Confidence', confidence.toUpperCase()),
    field('Analysis', analysis, false),
  );
  if (confidence === 'insufficient') {
    embed.addFields(field('Next signal', 'Keep telemetry active until the comparison window has enough measured events.', false));
  }
  return embed;
}

function error({ title = 'Request Failed', reason, action, code } = {}) {
  const embed = base({ title, eyebrow: 'SYSTEM', color: COLORS.error, footer: 'ProMcBot • System' });
  embed.setDescription('We could not complete this action.');
  embed.addFields(field('Reason', reason || 'The service returned an unexpected response.', false));
  if (action) embed.addFields(field('Next step', action, false));
  if (code) embed.addFields(field('Reference', `\`${code}\``, false));
  return embed;
}

function loading({ title = 'Working', message = 'Processing your request...' } = {}) {
  return base({ title, eyebrow: 'PROCESSING', description: message, color: COLORS.info, footer: 'ProMcBot • Live operation' });
}

function success({ title = 'Completed', message, footer = 'ProMcBot • Completed' } = {}) {
  return base({ title, eyebrow: 'SUCCESS', description: message, color: COLORS.success, footer });
}

function warning({ title = 'Action Needs Review', message } = {}) {
  return base({ title, eyebrow: 'ATTENTION', description: message, color: COLORS.warning, footer: 'ProMcBot • Review required' });
}

function info({ title = 'ProMcBot', message } = {}) {
  return base({ title, eyebrow: 'INFO', description: message, color: COLORS.info, footer: 'ProMcBot • Information' });
}

module.exports = { COLORS, base, field, timestamp, serverHealth, intelligence, error, loading, success, warning, info, safe, statusLine };
