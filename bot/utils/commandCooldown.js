'use strict';

const DEFAULT_COOLDOWN_MS = 1500;
const SENSITIVE_COOLDOWN_MS = 3000;
const MAX_ENTRIES = 10000;

function getCooldownMs(command) {
  if (command && command.cooldown === false) return 0;
  if (command && Number.isFinite(Number(command.cooldown))) return Math.max(500, Number(command.cooldown) * 1000);
  return command && command.userPermissions !== undefined ? SENSITIVE_COOLDOWN_MS : DEFAULT_COOLDOWN_MS;
}

function consumeCommandCooldown(store, identity, command, now = Date.now()) {
  const cooldownMs = getCooldownMs(command);
  if (!store || cooldownMs <= 0) return { allowed: true, retryAfterMs: 0 };
  const key = `${String(identity?.userId || '')}:${String(identity?.guildId || 'dm')}:${String(identity?.commandName || '')}`;
  if (!key.startsWith(':') && store.has(key)) {
    const availableAt = Number(store.get(key)) + cooldownMs;
    if (now < availableAt) return { allowed: false, retryAfterMs: availableAt - now };
  }
  store.set(key, now);
  if (store.size > MAX_ENTRIES) {
    for (const [entryKey, timestamp] of store) {
      if (now - Number(timestamp) > SENSITIVE_COOLDOWN_MS * 2) store.delete(entryKey);
      if (store.size <= MAX_ENTRIES) break;
    }
  }
  return { allowed: true, retryAfterMs: 0 };
}

module.exports = { DEFAULT_COOLDOWN_MS, SENSITIVE_COOLDOWN_MS, getCooldownMs, consumeCommandCooldown };
