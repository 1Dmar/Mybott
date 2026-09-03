'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const dashboardSource = fs.readFileSync(path.join(__dirname, '../dash/index.js'), 'utf8');

test('Smart Action enablement uses explicit create/update persistence', () => {
  assert.match(dashboardSource, /const ruleData = \{/);
  assert.match(dashboardSource, /AutomationRule\.findOneAndUpdate\(\{ _id: existing\._id/);
  assert.match(dashboardSource, /AutomationRule\.create\(\{ \.\.\.ruleData, serverId: req\.params\.guildId/);
  assert.doesNotMatch(dashboardSource, /\{ upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true \}/);
});

test('Smart Action audit failure does not turn a saved action into a failed request', () => {
  assert.match(dashboardSource, /recordAudit\(\{ actorId: req\.user\.id, guildId: req\.params\.guildId, action: existing \? 'smart_action_enabled' : 'smart_action_created'[\s\S]*?\}\)\.catch\(/);
});
