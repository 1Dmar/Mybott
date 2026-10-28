'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const service = fs.readFileSync(path.join(__dirname, '..', 'bot', 'utils', 'testLabService.js'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '..', 'dash', 'dashboard', 'pages', 'admin-test-lab.html'), 'utf8');

test('Test Lab staggers bot handshakes to protect the Minecraft server tick loop', () => {
  assert.match(service, /BOT_CONNECT_STAGGER_MS\s*=\s*2000/);
  assert.match(service, /schedule\(\(\) => connectBot\(index\), \(index - 1\) \* BOT_CONNECT_STAGGER_MS\)/);
  assert.doesNotMatch(service, /for \(let index = 1; index <= session\.requestedBots; index \+= 1\) \{\s*const username = botUsername\(index\);\s*const bot = mineflayer\.createBot/s);
});

test('Test Lab explains that invalid sessions require offline mode', () => {
  assert.match(service, /invalid session|failed to verify username/);
  assert.match(service, /requires an offline-mode Minecraft server/);
  assert.match(page, /offline-mode test clients/);
  assert.match(page, /production online-mode servers are not supported/);
});
