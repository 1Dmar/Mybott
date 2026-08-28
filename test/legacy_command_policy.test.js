'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { legacyPrefixEnabled } = require('../bot/utils/legacyCommandPolicy');

test('legacy prefix commands are opt-in', () => {
  assert.equal(legacyPrefixEnabled({}), false);
  assert.equal(legacyPrefixEnabled({ ENABLE_LEGACY_PREFIX_COMMANDS: 'false' }), false);
  assert.equal(legacyPrefixEnabled({ ENABLE_LEGACY_PREFIX_COMMANDS: 'true' }), true);
});

test('legacy prefix gate does not remove AutoMod or AutoResponder listeners', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'bot', 'events', 'messageCreate.js'), 'utf8');
  assert.match(source, /await handleAutoResponder\(message\)/);
  assert.match(source, /await handleAutoMod\(client, message\)/);
  assert.match(source, /if \(!legacyPrefixEnabled\(\)\) return;/);
});
