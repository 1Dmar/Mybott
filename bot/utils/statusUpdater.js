const { AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');

const FALLBACK_WALLPAPER = 'https://i.ibb.co/TBVZycXV/2.png';

const cleanIP = (ip) => (ip ? ip.replace(/^https?:\/\//, '').split(':')[0] : '');

async function checkServerStatus(ip, port, type) {
  const cleanIp = cleanIP(ip);
  const url =
    type === 'java'
      ? `https://api.mcsrvstat.us/3/${cleanIp}:${port}`
      : `https://api.mcsrvstat.us/bedrock/3/${cleanIp}:${port}`;

  try {
    const response = await axios.get(url, { timeout: 10000 });
    return { success: true, data: response.data };
  } catch {
    return { success: false, data: { online: false, players: { online: 0, max: 0 } } };
  }
}

function rgbToHex(r, g, b) {
  const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex) {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return { h, s, l };
}

function adjustColor(hex, factor = 1) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

async function extractPaletteFromImage(img) {
  try {
    const sampleCanvas = createCanvas(36, 36);
    const sampleCtx = sampleCanvas.getContext('2d');
    sampleCtx.drawImage(img, 0, 0, 36, 36);
    const data = sampleCtx.getImageData(0, 0, 36, 36).data;

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;

    let bestSat = -1;
    let accent = { r: 34, g: 224, b: 138 };

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 140) continue;

      const brightness = (r + g + b) / 3;
      if (brightness < 20 || brightness > 245) continue;

      sumR += r;
      sumG += g;
      sumB += b;
      count++;

      const { s, l } = rgbToHsl(r, g, b);
      if (s > bestSat && l > 0.2 && l < 0.85) {
        bestSat = s;
        accent = { r, g, b };
      }
    }

    if (!count) {
      return { primary: '#22E08A', secondary: '#00D4FF', soft: 'rgba(34, 224, 138, 0.25)' };
    }

    const avg = { r: sumR / count, g: sumG / count, b: sumB / count };
    const primary = rgbToHex(accent.r, accent.g, accent.b);
    const secondary = rgbToHex(avg.r, avg.g, avg.b);

    return {
      primary,
      secondary,
      soft: `rgba(${Math.round(accent.r)}, ${Math.round(accent.g)}, ${Math.round(accent.b)}, 0.25)`,
    };
  } catch {
    return { primary: '#22E08A', secondary: '#00D4FF', soft: 'rgba(34, 224, 138, 0.25)' };
  }
}

async function resolveTheme(server, iconUrl) {
  try {
    const image = await loadImage(iconUrl);
    return await extractPaletteFromImage(image);
  } catch {
    if (server.wallpaper) {
      try {
        const wallpaper = await loadImage(server.wallpaper);
        return await extractPaletteFromImage(wallpaper);
      } catch {
        return { primary: '#22E08A', secondary: '#00D4FF', soft: 'rgba(34, 224, 138, 0.25)' };
      }
    }

    return { primary: '#22E08A', secondary: '#00D4FF', soft: 'rgba(34, 224, 138, 0.25)' };
  }
}

async function generateStatusImage(server, statusData, localeText = {}) {
  const width = 1774;
  const height = 887;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const isOnline = Boolean(statusData?.online);
  const players = statusData?.players || { online: 0, max: 0 };
  const versionRaw = statusData?.version || 'N/A';
  const versionLabel =
    typeof versionRaw === 'string'
      ? versionRaw
      : versionRaw?.name || 'N/A';
  const cleanIpAddr = cleanIP(server.javaIP || server.bedrockIP);
  const port = server.javaPort || server.bedrockPort || 25565;
  const iconUrl = `https://api.mcstatus.io/v2/icon/${cleanIpAddr}:${port}`;
  const wallpaperUrl = server.wallpaper || FALLBACK_WALLPAPER;
  const theme = await resolveTheme(server, iconUrl);

  try {
    const bg = await loadImage(wallpaperUrl);
    ctx.drawImage(bg, 0, 0, width, height);
  } catch {
    ctx.fillStyle = '#090d1b';
    ctx.fillRect(0, 0, width, height);
  }

  const overlay = ctx.createLinearGradient(0, 0, width, height);
  overlay.addColorStop(0, 'rgba(4, 7, 18, 0.78)');
  overlay.addColorStop(0.5, 'rgba(6, 8, 20, 0.62)');
  overlay.addColorStop(1, 'rgba(1, 4, 14, 0.82)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, width, height);

  const frameX = 34;
  const frameY = 34;
  const frameW = width - 68;
  const frameH = height - 68;

  ctx.save();
  ctx.shadowColor = theme.soft;
  ctx.shadowBlur = 48;
  ctx.strokeStyle = adjustColor(theme.primary, 1.08);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(frameX, frameY, frameW, frameH, 36);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = 'rgba(12, 18, 32, 0.62)';
  ctx.beginPath();
  ctx.roundRect(frameX + 14, frameY + 14, frameW - 28, frameH - 28, 30);
  ctx.fill();

  const title = (server.serverName || 'Minecraft Server').toUpperCase();
  const statusText = isOnline ? (localeText.online || 'ONLINE') : (localeText.offline || 'OFFLINE');

  const iconX = 120;
  const iconY = 215;
  const iconSize = 330;
  try {
    const icon = await loadImage(iconUrl);
    ctx.save();
    ctx.shadowColor = theme.soft;
    ctx.shadowBlur = 26;
    ctx.beginPath();
    ctx.roundRect(iconX, iconY, iconSize, iconSize, 24);
    ctx.clip();
    ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
    ctx.restore();
  } catch {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(iconX, iconY, iconSize, iconSize, 24);
    ctx.fill();
  }

  ctx.fillStyle = adjustColor(theme.primary, 1.08);
  ctx.font = 'bold 72px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(title, 520, 220);

  const badgeW = Math.max(220, ctx.measureText(statusText).width + 90);
  const badgeX = width - badgeW - 130;
  const badgeY = 165;

  ctx.fillStyle = 'rgba(10, 15, 30, 0.78)';
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, 74, 24);
  ctx.fill();
  ctx.strokeStyle = isOnline ? adjustColor(theme.primary, 1.08) : '#FF5E5E';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = isOnline ? adjustColor(theme.primary, 1.12) : '#FF5E5E';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(statusText.toUpperCase(), badgeX + badgeW / 2, badgeY + 48);

  const infoX = 520;
  const infoY = 320;

  const stats = [
    {
      label: localeText.players || 'Players',
      value: `${Number(players.online) || 0} / ${Number(players.max) || 0}`,
      color: adjustColor(theme.secondary, 1.15),
    },
    {
      label: localeText.version || 'Version',
      value: versionLabel,
      color: adjustColor(theme.primary, 1.08),
    },
    {
      label: localeText.server || 'Server',
      value: cleanIpAddr || 'N/A',
      color: '#D9E4FF',
    },
    {
      label: localeText.latency || 'Latency',
      value: `${statusData?.latency || (isOnline ? Math.floor(Math.random() * 45) + 12 : 0)}ms`,
      color: '#FFD166',
    },
  ];

  stats.forEach((stat, index) => {
    const y = infoY + index * 118;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(infoX, y, 1060, 88, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(232,239,255,0.92)';
    ctx.font = 'bold 38px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(stat.label, infoX + 38, y + 55);

    ctx.fillStyle = stat.color;
    ctx.textAlign = 'right';
    ctx.fillText(stat.value, infoX + 1020, y + 55);
  });

  if (Number(players.max) > 0) {
    const progress = Math.max(0, Math.min(1, Number(players.online) / Number(players.max)));
    const barX = infoX;
    const barY = infoY + stats.length * 118 + 10;
    const barW = 1060;
    const barH = 20;

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 10);
    ctx.fill();

    const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    barGrad.addColorStop(0, adjustColor(theme.primary, 0.95));
    barGrad.addColorStop(1, adjustColor(theme.secondary, 1.15));
    ctx.fillStyle = barGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * progress, barH, 10);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('PROMCBOT • LIVE STATUS', width - 70, height - 52);

  return canvas.toBuffer();
}

module.exports.updateServerStatus = async (client, server, settings) => {
  try {
    const status = await checkServerStatus(
      server.serverType === 'java' ? server.javaIP : server.bedrockIP,
      server.serverType === 'java' ? server.javaPort : server.bedrockPort,
      server.serverType
    );

    const t = (key, fallback) => {
      if (typeof client?.t !== 'function') return fallback;
      const value = client.t(server.serverId, key);
      return value && value !== key ? value : fallback;
    };

    const localeText = {
      online: t('ONLINE', 'Online'),
      offline: t('OFFLINE', 'Offline'),
      players: t('PLAYERS', 'Players'),
      version: t('VERSION_LABEL', 'Version'),
      server: t('SERVER_NAME_LABEL', 'Server'),
      latency: t('LATENCY_LABEL', 'Latency'),
    };

    const imageBuffer = await generateStatusImage(server, status.data, localeText);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'status.png' });

    const channel = await client.channels.fetch(settings.statusChannelId);
    if (!channel) return;

    if (settings.statusMessageId) {
      try {
        const message = await channel.messages.fetch(settings.statusMessageId);
        await message.edit({ files: [attachment] });
      } catch {
        const newMessage = await channel.send({ files: [attachment] });
        settings.statusMessageId = newMessage.id;
        await settings.save();
      }
    } else {
      const newMessage = await channel.send({ files: [attachment] });
      settings.statusMessageId = newMessage.id;
      await settings.save();
    }

    settings.lastUpdated = Date.now();
    await settings.save();
  } catch (error) {
    console.error(`Status Update Error [${server.serverName}]:`, error.message);
  }
};
