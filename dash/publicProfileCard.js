'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const CARD_WIDTH = 1536;
const CARD_HEIGHT = 1024;
const BANNER_PATH = path.join(__dirname, 'dashboard', 'assets', 'profile-card-banner.jpg');
const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;
const PROFILE_IMAGE_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net', 'images-ext-1.discordapp.net']);

function isAllowedProfileImageUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && !url.port && PROFILE_IMAGE_HOSTS.has(url.hostname.toLowerCase());
  } catch (_) {
    return false;
  }
}

function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[character]));
}

async function imageDataUri(url) {
  if (!isAllowedProfileImageUrl(url)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'ProMC-Bot/1.0 public-profile-card' } });
    if (!response.ok) return null;
    const contentType = String(response.headers.get('content-type') || '').split(';', 1)[0].toLowerCase();
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(contentType) || contentLength > MAX_PROFILE_IMAGE_BYTES) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_PROFILE_IMAGE_BYTES) return null;
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function displayFontSize(value) {
  const length = String(value || '').length;
  if (length <= 10) return 86;
  if (length <= 14) return 76;
  if (length <= 18) return 66;
  return 56;
}

function formatCount(value) {
  const count = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
  return count.toLocaleString('en-US');
}

function buildOverlay({ displayName, username, avatar, followers, likes }) {
  const nameSize = displayFontSize(displayName);
  const followerCount = escapeXml(formatCount(followers));
  const likeCount = escapeXml(formatCount(likes));
  const avatarMarkup = avatar
    ? `<image href="${avatar}" x="143" y="326" width="352" height="352" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
    <defs>
      <linearGradient id="lowerFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#080817" stop-opacity=".12"/><stop offset=".2" stop-color="#080817" stop-opacity=".94"/><stop offset="1" stop-color="#080817" stop-opacity="1"/></linearGradient>
      <linearGradient id="cardGlow" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#251437" stop-opacity=".94"/><stop offset="1" stop-color="#100d25" stop-opacity=".94"/></linearGradient>
      <clipPath id="avatarClip"><circle cx="319" cy="502" r="176"/></clipPath>
      <filter id="shadow"><feGaussianBlur stdDeviation="18"/></filter>
    </defs>
    <rect x="0" y="280" width="${CARD_WIDTH}" height="744" fill="url(#lowerFade)"/>
    <ellipse cx="319" cy="695" rx="215" ry="35" fill="#ff3bb5" opacity=".25" filter="url(#shadow)"/>
    ${avatarMarkup}
    <circle cx="319" cy="502" r="181" fill="none" stroke="#ff4fb8" stroke-width="7"/>
    <circle cx="319" cy="502" r="188" fill="none" stroke="#ff9dd8" stroke-opacity=".35" stroke-width="2"/>
    <text x="555" y="462" font-family="Arial,sans-serif" font-size="${nameSize}" font-weight="800" letter-spacing="-2" fill="#fff8ff">${displayName}</text>
    <text x="560" y="526" font-family="Arial,sans-serif" font-size="31" font-weight="700" fill="#e7a5d2">@${username}</text>
    <circle cx="560" cy="570" r="9" fill="#52f2aa"/><text x="584" y="579" font-family="Arial,sans-serif" font-size="20" font-weight="700" letter-spacing="2" fill="#d9c9ef">PUBLIC PROFILE</text>
    <rect x="930" y="392" width="490" height="232" rx="28" fill="url(#cardGlow)" stroke="#ff55bc" stroke-opacity=".6" stroke-width="3"/>
    <circle cx="1008" cy="462" r="18" fill="#ff4fb8" opacity=".95"/><circle cx="1027" cy="453" r="12" fill="#ff9a5f" opacity=".9"/>
    <text x="1060" y="474" font-family="Arial,sans-serif" font-size="17" font-weight="800" letter-spacing="2" fill="#dcb9e2">FOLLOWERS</text>
    <text x="1004" y="558" font-family="Arial,sans-serif" font-size="52" font-weight="800" fill="#fff8ff">${followerCount}</text>
    <line x1="1172" y1="435" x2="1172" y2="580" stroke="#ffb1df" stroke-opacity=".22" stroke-width="2"/>
    <path d="M1242 468c-18-25-55 1 0 48 55-47 18-73 0-48z" fill="#ff4fb8"/>
    <text x="1274" y="474" font-family="Arial,sans-serif" font-size="17" font-weight="800" letter-spacing="2" fill="#dcb9e2">LIKES</text>
    <text x="1240" y="558" font-family="Arial,sans-serif" font-size="52" font-weight="800" fill="#fff8ff">${likeCount}</text>
    <circle cx="1400" cy="850" r="3" fill="#ff72c9"/><circle cx="1450" cy="790" r="2" fill="#f7c66d"/><circle cx="480" cy="875" r="3" fill="#b28cff"/>
  </svg>`;
}

async function renderPublicProfileCard(profile = {}) {
  const displayName = escapeXml(String(profile.globalName || profile.username || 'ProMC Bot user').slice(0, 24));
  const username = escapeXml(String(profile.username || 'user').slice(0, 28));
  const avatar = await imageDataUri(profile.avatar);
  const banner = await sharp(fs.readFileSync(BANNER_PATH)).resize(CARD_WIDTH, 430, { fit: 'cover' }).png().toBuffer();
  const overlay = Buffer.from(buildOverlay({ displayName, username, avatar, followers: profile.followers, likes: profile.likes }));
  return sharp({ create: { width: CARD_WIDTH, height: CARD_HEIGHT, channels: 4, background: '#080817' } })
    .composite([{ input: banner, top: 0, left: 0 }, { input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

module.exports = { renderPublicProfileCard, isAllowedProfileImageUrl };
