'use strict';

function buildPublicBaseUrl(req, env = process.env) {
  const configured = String(env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) {
    const parsed = new URL(configured);
    if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error('public_base_url_must_use_https');
    return parsed.origin;
  }
  if (env.NODE_ENV === 'production') throw new Error('public_base_url_not_configured');
  const protocol = String(req?.protocol || 'http').toLowerCase();
  const host = String(req?.get?.('host') || '').trim();
  if (!host || !/^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(host)) throw new Error('request_host_invalid');
  return `${protocol}://${host}`;
}

module.exports = { buildPublicBaseUrl };
