'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { renderPublicProfileCard } = require('../dash/publicProfileCard');

const rendererSource = fs.readFileSync(require.resolve('../dash/publicProfileCard'), 'utf8');
const profilePageSource = fs.readFileSync(require.resolve('../dash/dashboard/pages/profile.html'), 'utf8');
const serverSource = fs.readFileSync(require.resolve('../dash/index.js'), 'utf8');

 test('public profile card renders the supplied 3:2 template with dynamic profile fields', async () => {
  const buffer = await renderPublicProfileCard({
    id: '804999528129363998',
    username: 'alim',
    globalName: 'Ali M.',
    memberSince: '2026-08-28T00:00:00.000Z',
    customStatus: 'Building with ProMC Bot',
    followers: 99,
    likes: 88
  });
  const metadata = await sharp(buffer).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 1536);
  assert.equal(metadata.height, 1024);
  assert.ok(buffer.length > 5000);
});

test('public profile card uses the fixed official reference template', () => {
  assert.match(rendererSource, /public-profile-template-clean\.png/);
  assert.match(rendererSource, /CARD_WIDTH = 1536/);
  assert.match(rendererSource, /CARD_HEIGHT = 1024/);
  assert.doesNotMatch(rendererSource, /Powered by ProMcBot/);
  assert.doesNotMatch(rendererSource, /A shareable Discord identity card powered by ProMC Bot/);
  assert.doesNotMatch(rendererSource, /Building with ProMC Bot/);
  assert.match(rendererSource, />FOLLOWERS</);
  assert.match(rendererSource, />LIKES</);
  assert.match(rendererSource, /profile\.followers/);
  assert.match(rendererSource, /profile\.likes/);
  assert.doesNotMatch(rendererSource, /Discord handle|Profile ID/);
  assert.match(rendererSource, /controller\.abort\(\)/);
  assert.match(rendererSource, /8 \* 1024 \* 1024/);
});

test('fixed template asset is present and has the supplied 3:2 dimensions', async () => {
  const assetPath = path.join(__dirname, '..', 'dash', 'dashboard', 'assets', 'public-profile-template-clean.png');
  assert.equal(fs.existsSync(assetPath), true);
  const metadata = await sharp(assetPath).metadata();
  assert.equal(metadata.width / metadata.height, 1.5);
});

test('public profile page keeps the official footer logo and current copy', () => {
  assert.match(profilePageSource, /class="public-profile-copyright-logo" src="\/dashboard\/logo\.png"/);
  assert.doesNotMatch(profilePageSource, /Building with ProMC Bot/);
  assert.doesNotMatch(profilePageSource, /A shareable identity card powered by ProMC Bot/);
  assert.doesNotMatch(profilePageSource, /class="p-mark"/);
});

test('canonical /u route uses the fixed-template Open Graph contract', () => {
  assert.match(serverSource, /app\.get\('\/u\/:identifier'/);
  assert.match(serverSource, /meta property="og:image:width" content="1536"/);
  assert.match(serverSource, /meta property="og:image:height" content="1024"/);
  assert.match(serverSource, /profile-card-v2\//);
  assert.match(serverSource, /return \{ \.\.\.data, profileUserId: data\.profile\.id \}/);
  assert.match(serverSource, /const description = `@\$\{username\} · \$\{social\.likes\} like/);
  assert.doesNotMatch(serverSource, /const description = `\$\{displayName\} \(@\$\{username\}\) · \$\{social\.followers\}/);
});
