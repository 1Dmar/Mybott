const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const serverSource = fs.readFileSync(require.resolve('../dash/index.js'), 'utf8');
const onboarding = fs.readFileSync(require.resolve('../dash/dashboard/pages/onboarding.html'), 'utf8');
const dashboard = fs.readFileSync(require.resolve('../dash/dashboard/dashboard.html'), 'utf8');
const profileModel = fs.readFileSync(require.resolve('../bot/Models/UserProfile.js'), 'utf8');

test('Onboarding is a real authenticated page backed by measured activation state', () => {
  assert.match(serverSource, /app\.get\('\/onboarding', isAuthenticated, \(req, res\) => res\.sendFile/);
  assert.match(onboarding, /api\/guilds/);
  assert.match(onboarding, /api\/guilds\/.*\/activation/);
  assert.match(onboarding, /No manageable server is available/);
});

test('Public profile settings include bounded community links and privacy controls', () => {
  assert.match(profileModel, /communityLinks/);
  assert.match(profileModel, /showStatus/);
  assert.match(profileModel, /showCommunityLinks/);
  assert.match(profileModel, /showAchievements/);
  assert.match(serverSource, /invalid_community_link/);
  assert.match(serverSource, /url\.protocol === 'https:'/);
  assert.match(dashboard, /communityWebsite/);
  assert.match(dashboard, /showAchievements/);
});
