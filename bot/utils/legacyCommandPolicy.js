'use strict';

function legacyPrefixEnabled(env = process.env) {
  return String(env.ENABLE_LEGACY_PREFIX_COMMANDS || '').toLowerCase() === 'true';
}

module.exports = { legacyPrefixEnabled };
