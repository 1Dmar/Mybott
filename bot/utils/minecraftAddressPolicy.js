'use strict';

const net = require('net');

function normalizeMinecraftAddress(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > 255) return '';
  if (/[\u0000-\u0020\\/?#@%]/.test(raw)) return '';
  let host = raw;
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (!host || host.length > 253) return '';
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) return host;
  if (ipVersion === 6) return `[${host}]`;
  const hostname = host.endsWith('.') ? host.slice(0, -1) : host;
  if (!hostname || hostname.length > 253) return '';
  const labels = hostname.split('.');
  if (labels.some(label => !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))) return '';
  return hostname.toLowerCase();
}

function isSafeMinecraftAddress(value) {
  return Boolean(normalizeMinecraftAddress(value));
}

module.exports = { isSafeMinecraftAddress, normalizeMinecraftAddress };
