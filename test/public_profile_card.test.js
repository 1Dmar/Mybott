'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const sharp = require('sharp');
const { renderPublicProfileCard } = require('../dash/publicProfileCard');

const rendererSource = fs.readFileSync(require.resolve('../dash/publicProfileCard'), 'utf8');
const profilePageSource = fs.readFileSync(require.resolve('../dash/dashboard/pages/profile.html'), 'utf8');
const serverSource = fs.readFileSync(require.resolve('../dash/index.js'), 'utf8');

test('public profile card renders a 1200×630 PNG with only the modern profile fields', async () => {
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
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
  assert.ok(buffer.length > 5000);
});

test('public profile card uses the official circular logo and excludes legacy marketing copy', () => {
  assert.match(rendererSource, /path\.join\(__dirname, 'dashboard', 'logo\.png'\)/);
  assert.match(rendererSource, /Powered by ProMcBot/);
  assert.doesNotMatch(rendererSource, /A shareable Discord identity card powered by ProMC Bot/);
  assert.doesNotMatch(rendererSource, /Building with ProMC Bot/);
  assert.doesNotMatch(rendererSource, /followers|likes|Discord handle|Profile ID/);
  assert.match(rendererSource, /clip-path="url\(#logoClip\)"/);
});

test('public profile page keeps the official footer logo and current copy', () => {
  assert.match(profilePageSource, /class="public-profile-copyright-logo" src="\/dashboard\/logo\.png"/);
  assert.doesNotMatch(profilePageSource, /Building with ProMC Bot/);
  assert.doesNotMatch(profilePageSource, /A shareable identity card powered by ProMC Bot/);
  assert.doesNotMatch(profilePageSource, /class="p-mark"/);
});

test('canonical /u route keeps the modern Open Graph HTML contract', () => {
  assert.match(serverSource, /app\.get\('\/u\/:identifier'/);
  assert.match(serverSource, /meta property="og:image:width" content="1200"/);
  assert.match(serverSource, /meta property="og:image:height" content="630"/);
  assert.match(serverSource, /profile-card-v2\//);
  assert.match(serverSource, /Public Discord profile on ProMcBot/);
  assert.doesNotMatch(serverSource, /const description = `\$\{displayName\} \(@\$\{username\}\) · \$\{social\.followers\}/);
});
