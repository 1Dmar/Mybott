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

function formatMemberSince(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

async function renderPublicProfileCard(profile = {}) {
  const displayName = escapeXml(String(profile.globalName || profile.username || 'ProMC Bot user').slice(0, 24));
  const username = escapeXml(String(profile.username || 'user').slice(0, 28));
  const memberSince = escapeXml(formatMemberSince(profile.memberSince));
  const avatar = await imageDataUri(profile.avatar);
  const officialLogo = localLogoDataUri();
  const avatarMarkup = avatar
    ? `<image href="${avatar}" x="104" y="184" width="252" height="252" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
    : `<text x="230" y="355" text-anchor="middle" font-family="Arial,sans-serif" font-size="110" font-weight="900" fill="#f4f9ff">?</text>`;
  const logoMarkup = officialLogo ? `<image href="${officialLogo}" x="967" y="59" width="44" height="44" preserveAspectRatio="xMidYMid meet" clip-path="url(#logoClip)"/>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#02050c"/><stop offset=".52" stop-color="#071126"/><stop offset="1" stop-color="#160b1f"/></linearGradient>
      <radialGradient id="blueLight" cx="20%" cy="50%" r="45%"><stop offset="0" stop-color="#315bff" stop-opacity=".55"/><stop offset=".45" stop-color="#113eae" stop-opacity=".18"/><stop offset="1" stop-color="#113eae" stop-opacity="0"/></radialGradient>
      <radialGradient id="pinkLight" cx="84%" cy="43%" r="42%"><stop offset="0" stop-color="#e451bd" stop-opacity=".34"/><stop offset=".5" stop-color="#7d38aa" stop-opacity=".1"/><stop offset="1" stop-color="#7d38aa" stop-opacity="0"/></radialGradient>
      <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#10182a" stop-opacity=".83"/><stop offset=".58" stop-color="#070d1c" stop-opacity=".82"/><stop offset="1" stop-color="#0c0b18" stop-opacity=".9"/></linearGradient>
      <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ecf6ff"/><stop offset=".35" stop-color="#6b93ff"/><stop offset=".72" stop-color="#7a63ff"/><stop offset="1" stop-color="#f28bd8"/></linearGradient>
      <linearGradient id="accentText" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#73a4ff"/><stop offset="1" stop-color="#b59bff"/></linearGradient>
      <linearGradient id="pill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".09"/><stop offset="1" stop-color="#ffffff" stop-opacity=".025"/></linearGradient>
      <clipPath id="avatarClip"><circle cx="230" cy="310" r="126"/></clipPath>
      <clipPath id="logoClip"><circle cx="989" cy="81" r="22"/></clipPath>
      <filter id="avatarGlow"><feGaussianBlur stdDeviation="18"/></filter>
      <filter id="softBlur"><feGaussianBlur stdDeviation="38"/></filter>
    </defs>
    <rect width="1200" height="630" fill="#01030a"/>
    <rect width="1200" height="630" fill="url(#background)"/>
    <ellipse cx="178" cy="322" rx="350" ry="275" fill="url(#blueLight)" filter="url(#softBlur)"/>
    <ellipse cx="1015" cy="280" rx="310" ry="260" fill="url(#pinkLight)" filter="url(#softBlur)"/>
    <rect x="20" y="20" width="1160" height="590" rx="30" fill="url(#panel)" stroke="#66749c" stroke-opacity=".44" stroke-width="2"/>
    <path d="M46 165 C260 54 525 58 715 126 S1018 226 1154 112" fill="none" stroke="#8cb4ff" stroke-opacity=".08" stroke-width="2"/>
    <path d="M48 492 C278 580 520 558 735 488 S1016 402 1154 498" fill="none" stroke="#b687f5" stroke-opacity=".07" stroke-width="2"/>
    <g fill="#d9e8ff" opacity=".64"><circle cx="62" cy="78" r="2"/><circle cx="112" cy="536" r="2"/><circle cx="304" cy="74" r="2"/><circle cx="390" cy="566" r="2"/><circle cx="618" cy="78" r="2"/><circle cx="806" cy="102" r="2"/><circle cx="960" cy="544" r="2"/><circle cx="1144" cy="198" r="2"/><circle cx="1122" cy="546" r="2"/></g>
    <circle cx="230" cy="310" r="158" fill="#3477ff" opacity=".24" filter="url(#avatarGlow)"/>
    <circle cx="230" cy="310" r="146" fill="none" stroke="#6c7a9d" stroke-opacity=".46" stroke-width="2"/>
    <circle cx="230" cy="310" r="137" fill="none" stroke="url(#ring)" stroke-width="7"/>
    <circle cx="230" cy="310" r="126" fill="#152d61"/>
    ${avatarMarkup}
    <circle cx="230" cy="310" r="126" fill="none" stroke="#f4f9ff" stroke-opacity=".66" stroke-width="2"/>
    <circle cx="989" cy="81" r="25" fill="#060a13" stroke="#8ea7dd" stroke-opacity=".52" stroke-width="2"/>
    ${logoMarkup}
    <text x="1023" y="87" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#c7d7f4">Powered by ProMcBot</text>
    <text x="430" y="292" font-family="Arial,sans-serif" font-size="64" font-weight="900" letter-spacing="-1.5" fill="#f8fbff">${displayName}</text>
    <text x="434" y="347" font-family="Arial,sans-serif" font-size="25" font-weight="700" fill="url(#accentText)">@${username}</text>
    <rect x="430" y="383" width="194" height="42" rx="21" fill="url(#pill)" stroke="#8295c0" stroke-opacity=".34" stroke-width="2"/>
    <circle cx="454" cy="404" r="5" fill="#65efb1"/>
    <text x="471" y="411" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="#eef5ff">Public Profile</text>
    <line x1="430" y1="474" x2="1096" y2="474" stroke="#8ca0c7" stroke-opacity=".26" stroke-width="2"/>
    <rect x="430" y="509" width="34" height="34" rx="9" fill="#172a59" stroke="#6fa7ff" stroke-opacity=".48" stroke-width="2"/>
    <path d="M440 521h14M440 529h14M443 516v6M451 516v6M440 536h14" fill="none" stroke="#76a5ff" stroke-width="1.5" stroke-linecap="round"/>
    <text x="486" y="524" font-family="Arial,sans-serif" font-size="12" font-weight="700" letter-spacing="2" fill="#8799bb">MEMBER SINCE</text>
    <text x="486" y="551" font-family="Arial,sans-serif" font-size="22" font-weight="500" fill="#f4f8ff">${memberSince}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { renderPublicProfileCard };
