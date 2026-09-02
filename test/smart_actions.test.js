'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SMART_ACTION_PRESETS, getSmartActionPreset, smartActionCatalog, validateSmartActionChannel } = require('../bot/utils/smartActions');

 test('Smart Actions exposes deterministic P0 presets without a duplicate engine', () => {
  assert.deepEqual(SMART_ACTION_PRESETS.map(preset => preset.key), ['server_offline', 'server_recovered', 'telemetry_delayed', 'first_player']);
  assert.equal(getSmartActionPreset('server_offline').trigger, 'server_offline');
  assert.equal(getSmartActionPreset('missing'), null);
});

test('Smart Action catalog reuses entitlement feature access and existing rules', () => {
  const catalog = smartActionCatalog([{ preset: 'server_offline', _id: 'rule-1', enabled: true, channelId: '123456789012345678' }], { plan: 'free', features: { 'automation.basic': true } });
  const offline = catalog.find(item => item.key === 'server_offline');
  const recovered = catalog.find(item => item.key === 'server_recovered');
  assert.equal(offline.status, 'enabled');
  assert.equal(offline.ruleId, 'rule-1');
  assert.equal(offline.available, true);
  assert.equal(recovered.status, 'available');
});

test('Smart Action channel validation rejects unsafe or malformed identifiers', () => {
  assert.equal(validateSmartActionChannel('123456789012345678'), '123456789012345678');
  assert.equal(validateSmartActionChannel('1'), null);
  assert.equal(validateSmartActionChannel('123456789012345678<script>'), null);
  assert.equal(validateSmartActionChannel(''), null);
});
