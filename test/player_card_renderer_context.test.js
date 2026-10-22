const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../bot/utils/playerCardGenerator.js'), 'utf8');

test('renderer accepts trusted profile context and uses measured card scope', () => {
  assert.match(source, /profileContext = null/);
  assert.match(source, /playerData\.profileContext/);
  assert.match(source, /measured\.sessionSeconds/);
  assert.match(source, /Global Player Account/);
});

test('renderer does not use a fabricated default server address', () => {
  assert.doesNotMatch(source, /play\.server\.com/);
  assert.match(source, /PROMCBOT SYSTEM/);
});
