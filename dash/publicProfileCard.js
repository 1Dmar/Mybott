'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[character]));
}

function localLogoDataUri() {
  try {
    const logoPath = path.join(__dirname, 'dashboard', 'logo.png');
    return `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
  } catch (_) {
    return null;
  }
}

async function imageDataUri(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'ProMC-Bot/1.0 public-profile-card' } });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (_) {
    return null;
  }
}

async function renderPublicProfileCard(profile = {}) {
  const displayName = escapeXml(String(profile.globalName || profile.username || 'ProMC Bot user').slice(0, 28));
  const username = escapeXml(String(profile.username || 'user').slice(0, 32));
  const discordUsername = escapeXml(String(profile.discordUsername || profile.username || 'user').slice(0, 32));
  const profileId = escapeXml(String(profile.id || '—'));
  const followers = Math.max(0, Number(profile.followers || 0));
  const likes = Math.max(0, Number(profile.likes || 0));
  const avatar = await imageDataUri(profile.avatar);
  const officialLogo = localLogoDataUri();
  const avatarMarkup = avatar
    ? `<image href="${avatar}" x="100" y="176" width="290" height="290" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
    : `<text x="245" y="360" text-anchor="middle" font-family="Arial,sans-serif" font-size="125" font-weight="900" fill="#f4f9ff">?</text>`;
  const watermark = officialLogo ? `<image href="${officialLogo}" x="930" y="36" width="34" height="34" preserveAspectRatio="xMidYMid meet"/>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#071b43"/><stop offset=".56" stop-color="#0b1025"/><stop offset="1" stop-color="#21112c"/></linearGradient>
      <radialGradient id="blueGlow" cx="22%" cy="52%" r="42%"><stop offset="0" stop-color="#3493ff" stop-opacity=".42"/><stop offset="1" stop-color="#3493ff" stop-opacity="0"/></radialGradient>
      <radialGradient id="violetGlow" cx="88%" cy="26%" r="42%"><stop offset="0" stop-color="#7d46ff" stop-opacity=".3"/><stop offset="1" stop-color="#7d46ff" stop-opacity="0"/></radialGradient>
      <linearGradient id="chip" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".12"/><stop offset="1" stop-color="#ffffff" stop-opacity=".035"/></linearGradient>
      <clipPath id="avatarClip"><circle cx="245" cy="321" r="145"/></clipPath>
      <filter id="glow"><feGaussianBlur stdDeviation="16"/></filter>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <rect width="1200" height="630" fill="url(#blueGlow)"/>
    <rect width="1200" height="630" fill="url(#violetGlow)"/>
    <g fill="#dff8ff" opacity=".7"><circle cx="70" cy="106" r="3"/><circle cx="158" cy="530" r="2"/><circle cx="284" cy="80" r="2"/><circle cx="510" cy="560" r="3"/><circle cx="780" cy="94" r="2"/><circle cx="1100" cy="120" r="3"/><circle cx="1142" cy="495" r="2"/><circle cx="960" cy="545" r="2"/><circle cx="635" cy="44" r="2"/><circle cx="410" cy="150" r="2"/></g>
    ${watermark}
    <text x="1180" y="61" text-anchor="end" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#b8d7f6">Powered by ProMcBot</text>
    <circle cx="245" cy="321" r="163" fill="#47bfff" opacity=".3" filter="url(#glow)"/>
    <circle cx="245" cy="321" r="155" fill="none" stroke="#8eeaff" stroke-opacity=".82" stroke-width="8"/>
    <circle cx="245" cy="321" r="145" fill="#1e3d7b"/>
    ${avatarMarkup}
    <text x="490" y="267" font-family="Arial,sans-serif" font-size="66" font-weight="900" fill="#f7fbff">${displayName}</text>
    <text x="490" y="322" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#4aa7ff">@${username}</text>
    <rect x="490" y="365" width="230" height="48" rx="24" fill="url(#chip)" stroke="#a4dbff" stroke-opacity=".23" stroke-width="2"/>
    <circle cx="514" cy="389" r="6" fill="#65efb1"/>
    <text x="530" y="397" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#f4f9ff">Public profile</text>
    <text x="490" y="465" font-family="Arial,sans-serif" font-size="20" font-weight="500" fill="#9ab0cf">Discord handle: @${discordUsername}</text>
    <text x="490" y="505" font-family="Arial,sans-serif" font-size="17" font-weight="500" fill="#7188aa">Profile ID ${profileId}</text>
    <text x="490" y="538" font-family="Arial,sans-serif" font-size="17" font-weight="500" fill="#7188aa">${followers.toLocaleString()} followers · ${likes.toLocaleString()} likes</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { renderPublicProfileCard };
