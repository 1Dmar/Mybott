'use strict';

const { normalizeMinecraftAddress } = require('../bot/utils/minecraftAddressPolicy');

function normalizeMinecraftSettings(body = {}) {
  const prefix = typeof body.prefix === 'string' ? body.prefix.trim().slice(0, 5) : '!';
  const language = body.language === 'ar' ? 'ar' : 'en';
  const rawMcIp = typeof body.mcIp === 'string' ? body.mcIp.trim().slice(0, 255) : '';
  const mcIp = normalizeMinecraftAddress(rawMcIp);
  const mcPort = body.mcPort === undefined || body.mcPort === null || String(body.mcPort).trim() === '' ? 25565 : Number(body.mcPort);
  if (rawMcIp && !mcIp) return { ok: false, error: 'invalid_minecraft_address' };
  if (!Number.isInteger(mcPort) || mcPort < 1 || mcPort > 65535) return { ok: false, error: 'invalid_minecraft_port' };
  return { ok: true, settings: { prefix, language, mcIp, mcPort } };
}

function buildServerInfoUpdate({ mcIp = '', mcPort = 25565 } = {}) {
  const update = { $set: { javaPort: mcPort } };
  if (mcIp) {
    update.$set.javaIP = mcIp;
    update.$set.serverType = 'java';
  } else {
    update.$unset = { javaIP: '', serverType: '' };
  }
  return update;
}

module.exports = { buildServerInfoUpdate, normalizeMinecraftSettings };
