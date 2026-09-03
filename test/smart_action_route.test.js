'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const dashboardSource = fs.readFileSync(path.join(__dirname, '../dash/index.js'), 'utf8');
const actionsPageSource = fs.readFileSync(path.join(__dirname, '../dash/dashboard/pages/actions.html'), 'utf8');

test('Smart Action enablement uses explicit create/update persistence', () => {
  assert.match(dashboardSource, /const ruleData = \{/);
  assert.match(dashboardSource, /AutomationRule\.findOneAndUpdate\(\{ _id: existing\._id/);
  assert.match(dashboardSource, /AutomationRule\.create\(\{ \.\.\.ruleData, serverId: req\.params\.guildId/);
  assert.doesNotMatch(dashboardSource, /\{ upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true \}/);
});

test('Smart Actions allow three active presets and replace the oldest on the fourth', () => {
  assert.match(dashboardSource, /const enabledActions = state\.rules/);
  assert.match(dashboardSource, /if \(enabledActions\.length >= 3\)/);
  assert.match(dashboardSource, /replacedAction = oldest\.preset/);
  assert.match(dashboardSource, /enabled: false/);
  assert.match(dashboardSource, /replacedAction \}/);
});

test('Smart Action replacement is restored if the new action cannot be saved', () => {
  assert.match(dashboardSource, /let replacedRule = null;/);
  assert.match(dashboardSource, /if \(replacedRule\) await AutomationRule\.updateOne/);
});

test('Smart Actions dashboard displays a replacement warning', () => {
  assert.match(actionsPageSource, /result\.replacedAction/);
  assert.match(actionsPageSource, /Limit reached:/);
});
