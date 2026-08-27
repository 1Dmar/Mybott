'use strict';

const axios = require('axios');
const Jimp = require('jimp');

const visualCache = new Map();
const DEFAULT_COLOR = '#5865f2';

function assetUrl(kind, guild) {
  const hash = guild?.[kind];
  if (!guild?.id || !hash) return null;
  const extension = String(hash).startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/${kind === 'banner' ? 'banners' : 'icons'}/${encodeURIComponent(guild.id)}/${hash}.${extension}?size=1024`;
}

function hex(red, green, blue) {
  return `#${[red, green, blue].map(value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
}

function dominantColorFromPixels(data, width, height) {
  const buckets = new Map();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha < 128) continue;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const brightness = (red + green + blue) / 3;
      if (brightness < 18 || brightness > 245) continue;
      const bucket = [red, green, blue].map(value => Math.round(value / 32) * 32).join(',');
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    }
  }
  const winner = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!winner) return DEFAULT_COLOR;
  const [red, green, blue] = winner[0].split(',').map(Number);
  return hex(red, green, blue);
}

async function dominantColorFromUrl(url) {
  if (!url) return DEFAULT_COLOR;
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 3500, maxContentLength: 2 * 1024 * 1024 });
    const image = await Jimp.read(response.data);
    image.scaleToFit(32, 32);
    return dominantColorFromPixels(image.bitmap.data, image.bitmap.width, image.bitmap.height);
  } catch (_) {
    return DEFAULT_COLOR;
  }
}

async function getGuildVisual(guild) {
  const bannerUrl = assetUrl('banner', guild);
  const iconUrl = assetUrl('icon', guild);
  const sourceUrl = bannerUrl || iconUrl;
  const cacheKey = `${guild?.id || 'unknown'}:${sourceUrl || 'none'}`;
  const cached = visualCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = { bannerUrl, iconUrl, dominantColor: await dominantColorFromUrl(sourceUrl), source: bannerUrl ? 'discord_banner' : iconUrl ? 'discord_icon' : 'default' };
  visualCache.set(cacheKey, { value, expiresAt: Date.now() + 15 * 60 * 1000 });
  return value;
}

module.exports = { DEFAULT_COLOR, assetUrl, dominantColorFromPixels, dominantColorFromUrl, getGuildVisual };
