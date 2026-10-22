const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const commandPath = require.resolve('../bot/Commands/Slash/Misc/playercard.js');
const source = fs.readFileSync(commandPath, 'utf8');
const command = require(commandPath);

test('playercard uses the linked Discord account by default', () => {
  const scope = command.options.find(option => option.name === 'scope');
  const ign = command.options.find(option => option.name === 'ign');
  assert.equal(scope.required, false);
  assert.equal(ign.required, false);
  assert.match(source, /PlayerAccount\.findOne/);
  assert.match(source, /MinecraftIdentity\.find/);
});

test('server scope requires a measured link for the current guild', () => {
  assert.match(source, /PlayerServerLink\.findOne/);
  assert.match(source, /serverId: interaction\.guild\.id/);
  assert.match(source, /لا توجد هوية مقاسة لك في هذا السيرفر/);
});

test('legacy IGN lookup is explicitly unverified and cannot load account data', () => {
  assert.match(source, /Legacy lookup is intentionally isolated/);
  assert.match(source, /Unverified public lookup/);
  assert.match(source, /does not use account statistics/);
});

test('saved card settings are bounded to approved templates', () => {
  assert.match(source, /PlayerCardSettings\.findOne/);
  for (const template of ['minecraft', 'darkmode', 'glass', 'minimal']) assert.match(source, new RegExp(template));
  assert.match(source, /requestedTemplate === 'saved'/);
});
