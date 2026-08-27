'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { renderPublicProfileCard } = require('../dash/publicProfileCard');

test('public profile card renders a Discord-sized PNG with ProMC Bot branding inputs', async () => {
  const buffer = await renderPublicProfileCard({ id: '804999528129363998', username: 'alim', globalName: 'Ali M.', customStatus: 'Public profile' });
  const metadata = await sharp(buffer).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
  assert.ok(buffer.length > 5000);
});
