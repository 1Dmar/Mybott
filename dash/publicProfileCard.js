'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const CARD_WIDTH = 1536;
const CARD_HEIGHT = 1024;
const TEMPLATE_PATH = path.join(__dirname, 'dashboard', 'assets', 'public-profile-template-clean.png');

function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[character]));
}

async function imageDataUri(url) {
  if (!url) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'ProMC-Bot/1.0 public-profile-card' }, signal: controller.signal });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'image/png';
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 8 * 1024 * 1024) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 8 * 1024 * 1024) return null;
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function formatMemberSince(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function displayFontSize(value) {
  const length = String(value || '').length;
  if (length <= 10) return 88;
  if (length <= 14) return 78;
  if (length <= 18) return 68;
  return 58;
}

function formatCount(value) {
  const count = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
  return count.toLocaleString('en-US');
}

function buildOverlay({ displayName, username, memberSince, avatar, followers, likes }) {
  const nameSize = displayFontSize(displayName);
  const followerCount = escapeXml(formatCount(followers));
  const likeCount = escapeXml(formatCount(likes));
  const estimatedNameWidth = Math.min(720, Math.max(180, displayName.length * nameSize * 0.55));
  const dotX = Math.min(1390, 648 + estimatedNameWidth + 20);
  const avatarMarkup = avatar
    ? `<image href="${avatar}" x="164" y="307" width="380" height="380" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
    <defs>
      <clipPath id="avatarClip"><circle cx="354" cy="497" r="188"/></clipPath>
    </defs>
    ${avatarMarkup}
    <circle cx="354" cy="497" r="188" fill="none" stroke="#edf5ff" stroke-opacity=".64" stroke-width="2"/>
    <text x="638" y="441" font-family="Arial,sans-serif" font-size="${nameSize}" font-weight="800" letter-spacing="-2" fill="#f8f9ff">${displayName}</text>
    <circle cx="${dotX}" cy="416" r="13" fill="#9b8cff"/>
    <text x="640" y="497" font-family="Arial,sans-serif" font-size="31" font-weight="700" fill="#7b9cff">@${username}</text>
    <rect x="638" y="535" width="238" height="58" rx="29" fill="#060b16" fill-opacity=".44" stroke="#a2b0c8" stroke-opacity=".26" stroke-width="2"/>
    <circle cx="671" cy="564" r="8" fill="#27e99e"/>
    <text x="700" y="573" font-family="Arial,sans-serif" font-size="24" font-weight="500" fill="#f7f9ff">Public Profile</text>
    <text x="731" y="729" font-family="Arial,sans-serif" font-size="27" font-weight="500" fill="#f8f9ff">${memberSince}</text>
    <text x="1000" y="688" font-family="Arial,sans-serif" font-size="15" font-weight="700" letter-spacing="2" fill="#8799bb">FOLLOWERS</text>
    <text x="1000" y="729" font-family="Arial,sans-serif" font-size="27" font-weight="500" fill="#f8f9ff">${followerCount}</text>
    <line x1="1160" y1="678" x2="1160" y2="744" stroke="#8ca0c7" stroke-opacity=".18" stroke-width="2"/>
    <text x="1200" y="688" font-family="Arial,sans-serif" font-size="15" font-weight="700" letter-spacing="2" fill="#8799bb">LIKES</text>
    <text x="1200" y="729" font-family="Arial,sans-serif" font-size="27" font-weight="500" fill="#f8f9ff">${likeCount}</text>
  </svg>`;
}

async function renderPublicProfileCard(profile = {}) {
  const displayName = escapeXml(String(profile.globalName || profile.username || 'ProMC Bot user').slice(0, 24));
  const username = escapeXml(String(profile.username || 'user').slice(0, 28));
  const memberSince = escapeXml(formatMemberSince(profile.memberSince));
  const avatar = await imageDataUri(profile.avatar);
  const template = fs.readFileSync(TEMPLATE_PATH);
  const overlay = Buffer.from(buildOverlay({ displayName, username, memberSince, avatar, followers: profile.followers, likes: profile.likes }));
  return sharp(template)
    .resize(CARD_WIDTH, CARD_HEIGHT, { fit: 'fill' })
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

module.exports = { renderPublicProfileCard };
