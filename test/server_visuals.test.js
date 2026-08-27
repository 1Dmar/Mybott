'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_COLOR, assetUrl, dominantColorFromPixels, dominantColorFromUrl, getGuildVisual } = require('../dash/serverVisuals');

test('server visual asset URLs use the Discord CDN without exposing secrets', () => {
  const guild = { id: '123', banner: 'banner-hash', icon: 'icon-hash' };
  assert.match(assetUrl('banner', guild), /discordapp\.com\/banners\/123\/banner-hash\.png\?size=1024$/);
  assert.match(assetUrl('icon', guild), /discordapp\.com\/icons\/123\/icon-hash\.png\?size=1024$/);
  assert.match(assetUrl('banner', { id: '123', banner: 'a_animated' }), /\.gif\?size=1024$/);
});

test('server visuals use a stable fallback when no Discord asset exists', async () => {
  assert.equal(await dominantColorFromUrl(null), DEFAULT_COLOR);
  assert.deepEqual(await getGuildVisual({ id: '123', name: 'No Asset' }), { bannerUrl: null, iconUrl: null, dominantColor: DEFAULT_COLOR, source: 'default' });
});

test('dominant color is calculated from opaque image pixels deterministically', () => {
  const pixels = Uint8ClampedArray.from([
    30, 90, 210, 255, 30, 90, 210, 255,
    30, 90, 210, 255, 250, 250, 250, 255,
  ]);
  assert.equal(dominantColorFromPixels(pixels, 2, 2), '#2060e0');
});
