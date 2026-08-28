'use strict';

function originOf(value) {
  try {
    return new URL(String(value || '').trim()).origin;
  } catch (_) {
    return null;
  }
}

function allowedOrigins(env = process.env) {
  const values = [env.PUBLIC_BASE_URL, env.PUBLIC_STATS_URL, ...(String(env.DASHBOARD_ALLOWED_ORIGINS || '').split(','))];
  return new Set(values.map(originOf).filter(Boolean));
}

function isAllowedCorsOrigin(origin, env = process.env) {
  if (!origin) return true;
  return allowedOrigins(env).has(originOf(origin));
}

function requestOrigin(req) {
  const origin = String(req.get?.('origin') || '').trim();
  if (origin) return origin;
  const referer = String(req.get?.('referer') || '').trim();
  return originOf(referer);
}

function isSameOriginMutation(req, env = process.env) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(String(req.method || '').toUpperCase())) return true;
  const origin = requestOrigin(req);
  if (!origin) return true;
  if (isAllowedCorsOrigin(origin, env)) return true;
  const requestHostOrigin = originOf(`${req.protocol || 'https'}://${req.get?.('host') || ''}`);
  return requestHostOrigin === origin;
}

module.exports = { originOf, allowedOrigins, isAllowedCorsOrigin, requestOrigin, isSameOriginMutation };
