const { AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage, registerFont } = require('canvas');

// Register fonts
const fontsDir = path.join(__dirname, '../src/fonts');
if (fs.existsSync(path.join(fontsDir, 'd.ttf'))) {
    registerFont(path.join(fontsDir, 'd.ttf'), { family: 'Minecraft' });
}

const cleanIP = (ip) => ip ? ip.replace(/^https?:\/\//, '').split(':')[0] : '';

// Minecraft backgrounds for auto-rotation
const MC_WALLPAPERS = [
    "https://i.ibb.co/TBVZycXV/2.png",
    "https://static1.srcdn.com/wordpress/wp-content/uploads/2022/05/Minecraft-Shader-Pine-Forest.jpg",
    "https://resourcepack.net/fl/images/2022/11/RedHat-Shaders-for-minecraft-5.jpg",
    "https://i.ibb.co/KpWg3FHw/687d56199156581-664cf6f062769.png",
    "https://i.ibb.co/qFrSvppV/1.png"
];

async function checkServerStatus(ip, port, type) {
    const cleanIp = cleanIP(ip);
    const url = type === 'java'
        ? `https://api.mcsrvstat.us/3/${cleanIp}:${port}`
        : `https://api.mcsrvstat.us/bedrock/3/${cleanIp}:${port}`;
    try {
        const response = await axios.get(url, { timeout: 10000 });
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, data: { online: false } };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawRoundRect helper
// ─────────────────────────────────────────────────────────────────────────────
function rr(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);     ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);     ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);         ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Draw a Minecraft-style item frame around a player head
// ─────────────────────────────────────────────────────────────────────────────
function drawItemFrame(ctx, x, y, size) {
    const padding = 6;
    const fx = x - padding;
    const fy = y - padding;
    const fSize = size + padding * 2;

    // Outer shadow
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowOffsetY = 3;

    // Outer dark oak border
    ctx.fillStyle = '#5C3A1E';
    ctx.beginPath(); rr(ctx, fx, fy, fSize, fSize, 4); ctx.fill();
    ctx.restore();

    // Inner wood gradient
    const woodGrad = ctx.createLinearGradient(fx, fy, fx + fSize, fy + fSize);
    woodGrad.addColorStop(0, '#A07850');
    woodGrad.addColorStop(0.5, '#8B6538');
    woodGrad.addColorStop(1, '#6B4A28');
    ctx.fillStyle = woodGrad;
    ctx.beginPath(); rr(ctx, fx + 2, fy + 2, fSize - 4, fSize - 4, 3); ctx.fill();

    // Wood grain lines
    ctx.strokeStyle = 'rgba(60,35,15,0.3)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(fx + 5, fy + 8 + i * 8);
        ctx.lineTo(fx + fSize - 5, fy + 8 + i * 8);
        ctx.stroke();
    }

    // Inner dark recess
    ctx.fillStyle = '#3A2510';
    ctx.beginPath(); rr(ctx, fx + 5, fy + 5, fSize - 10, fSize - 10, 2); ctx.fill();

    // Corner nails/rivets
    const nailOffset = 3;
    const corners = [
        [fx + nailOffset, fy + nailOffset],
        [fx + fSize - nailOffset, fy + nailOffset],
        [fx + nailOffset, fy + fSize - nailOffset],
        [fx + fSize - nailOffset, fy + fSize - nailOffset]
    ];
    corners.forEach(([nx, ny]) => {
        // Nail shadow
        ctx.fillStyle = '#2A1500';
        ctx.beginPath(); ctx.arc(nx + 0.5, ny + 0.5, 2.5, 0, Math.PI * 2); ctx.fill();
        // Nail highlight
        ctx.fillStyle = '#D4A850';
        ctx.beginPath(); ctx.arc(nx, ny, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#E8C870';
        ctx.beginPath(); ctx.arc(nx - 0.5, ny - 0.5, 1.2, 0, Math.PI * 2); ctx.fill();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Load player head avatars for online players
//  Randomly shuffles and picks heads so different players show each refresh
// ─────────────────────────────────────────────────────────────────────────────
async function loadPlayerHeads(playerList, maxHeads = 12) {
    if (!playerList || playerList.length === 0) return [];

    // Shuffle so we get random sample each refresh
    const shuffled = [...playerList].sort(() => Math.random() - 0.5);
    const sample   = shuffled.slice(0, maxHeads);

    const heads = await Promise.allSettled(
        sample.map(async (p) => {
            const name = typeof p === 'string' ? p : p.name;
            const url  = `https://crafatar.com/avatars/${name}?size=64&overlay=true`;
            try {
                const img  = await loadImage(url);
                return { name, img };
            } catch {
                // Fallback: generate initials avatar
                return { name, img: null };
            }
        })
    );

    return heads
        .filter(r => r.status === 'fulfilled' && r.value.img)
        .map(r => r.value);
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN IMAGE GENERATOR — Clean Card Design
// ─────────────────────────────────────────────────────────────────────────────
async function generateStatusImage(server, statusData, template = 'glass', autoWallpaper = true) {

    // ── Canvas ──
    const width  = 960;
    const height = 420;
    const canvas = createCanvas(width, height);
    const ctx    = canvas.getContext('2d');

    const isOnline    = statusData?.online;
    const players     = statusData?.players || { online: 0, max: 0 };
    const version     = statusData?.version || 'N/A';
    const versionLabel = typeof version === 'string' ? version : (version.name || 'N/A');
    const cleanIpAddr  = cleanIP(server.javaIP || server.bedrockIP);
    const port         = server.javaPort || server.bedrockPort || 25565;
    const iconUrl      = `https://api.mcstatus.io/v2/icon/${cleanIpAddr}:${port}`;

    // ── 1. Background wallpaper ──
    try {
        let wallpaperUrl = server.wallpaper;
        if (autoWallpaper || !wallpaperUrl) {
            const minute = new Date().getMinutes();
            wallpaperUrl = MC_WALLPAPERS[minute % MC_WALLPAPERS.length];
        }
        const bg = await loadImage(wallpaperUrl);
        ctx.drawImage(bg, 0, 0, width, height);
    } catch {
        // Fallback gradient
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#4FC3F7');
        grad.addColorStop(0.5, '#81C784');
        grad.addColorStop(1, '#AED581');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
    }

    // Blur overlay for readability
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, width, height);

    // ── 2. Main white card ──
    const cardPad = 24;
    const cX = cardPad, cY = cardPad;
    const cW = width - cardPad * 2, cH = height - cardPad * 2;
    const cr = 28;

    // Card shadow
    ctx.save();
    ctx.shadowBlur = 40;
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); rr(ctx, cX, cY, cW, cH, cr); ctx.fill();
    ctx.restore();

    // ── 3. Server Icon (left side) ──
    const iconAreaX = cX + 28;
    const iconAreaY = cY + 35;
    const iconAreaSize = 130;

    // Icon background gradient (cyan to yellow-green like reference)
    const iconBgGrad = ctx.createLinearGradient(iconAreaX, iconAreaY, iconAreaX + iconAreaSize, iconAreaY + iconAreaSize);
    iconBgGrad.addColorStop(0, '#5DDBF5');
    iconBgGrad.addColorStop(0.5, '#7AE8A0');
    iconBgGrad.addColorStop(1, '#C8E858');

    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(93,219,245,0.4)';
    ctx.fillStyle = iconBgGrad;
    ctx.beginPath(); rr(ctx, iconAreaX, iconAreaY, iconAreaSize, iconAreaSize, 28); ctx.fill();
    ctx.restore();

    // Draw server icon or cube fallback
    const iconDrawSize = 90;
    const iconDrawX = iconAreaX + (iconAreaSize - iconDrawSize) / 2;
    const iconDrawY = iconAreaY + (iconAreaSize - iconDrawSize) / 2;

    try {
        const icon = await loadImage(iconUrl);
        ctx.save();
        ctx.beginPath(); rr(ctx, iconDrawX, iconDrawY, iconDrawSize, iconDrawSize, 16); ctx.clip();
        ctx.drawImage(icon, iconDrawX, iconDrawY, iconDrawSize, iconDrawSize);
        ctx.restore();
    } catch {
        // 3D Cube drawing
        drawCubeIcon(ctx, iconDrawX + iconDrawSize/2, iconDrawY + iconDrawSize/2, 36);
    }

    // ── 4. Vertical divider ──
    const dividerX = iconAreaX + iconAreaSize + 28;
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dividerX, cY + 30);
    ctx.lineTo(dividerX, cY + cH - 90);
    ctx.stroke();

    // ── 5. Center: Status + Players ──
    const centerX = dividerX + 28;
    const centerY = cY + 45;

    // Status dot
    ctx.save();
    ctx.shadowBlur = isOnline ? 10 : 0;
    ctx.shadowColor = isOnline ? 'rgba(76,175,80,0.6)' : 'transparent';
    ctx.fillStyle = isOnline ? '#4CAF50' : '#F44336';
    ctx.beginPath(); ctx.arc(centerX + 10, centerY + 12, 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Status text
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillStyle = isOnline ? '#4CAF50' : '#F44336';
    ctx.textAlign = 'left';
    ctx.fillText(isOnline ? 'ONLINE' : 'OFFLINE', centerX + 28, centerY + 18);

    // Players icon + count
    const playersY = centerY + 55;

    // Draw people icon
    drawPeopleIcon(ctx, centerX, playersY, 22);

    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'left';
    ctx.fillText(`${players.online}`, centerX + 32, playersY + 22);

    ctx.font = '20px Arial, sans-serif';
    ctx.fillStyle = '#888888';
    ctx.fillText(`/ ${players.max}`, centerX + 32 + ctx.measureText(`${players.online}`).width + 6, playersY + 22);

    // "PLAYERS" label
    ctx.font = '13px Arial, sans-serif';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText('PLAYERS', centerX + 32, playersY + 40);

    // ── 6. Right side: Version + IP cards ──
    const rightX = centerX + 220;
    const rightW = 200;
    const cardH = 65;
    const cardGap = 12;

    // Version Card
    const verY = cY + 35;
    drawInfoCard(ctx, rightX, verY, rightW, cardH, 'VERSION', versionLabel, 'server');

    // IP Address Card
    const ipY = verY + cardH + cardGap;
    drawInfoCard(ctx, rightX, ipY, rightW, cardH, 'IP ADDRESS', cleanIpAddr || 'N/A', 'wifi');

    // ── 7. Bottom bar: Ping + Player Heads ──
    const bottomY = cY + cH - 72;
    const bottomPad = 20;

    // Horizontal divider above bottom bar
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cX + bottomPad, bottomY - 8);
    ctx.lineTo(cX + cW - bottomPad, bottomY - 8);
    ctx.stroke();

    // Ping (left side)
    const pingX = cX + bottomPad + 5;
    drawPingIcon(ctx, pingX, bottomY + 12, 18);

    ctx.font = '12px Arial, sans-serif';
    ctx.fillStyle = '#999999';
    ctx.textAlign = 'left';
    ctx.fillText('PING', pingX + 24, bottomY + 18);

    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillStyle = '#333333';
    ctx.fillText(isOnline ? '~28' : '--', pingX + 24, bottomY + 42);

    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#888888';
    ctx.fillText('ms', pingX + 24 + ctx.measureText(isOnline ? '~28' : '--').width + 4, bottomY + 42);

    // ── 8. Player Heads in Item Frames ──
    const playerList = statusData?.players?.list || [];
    const playerHeads = await loadPlayerHeads(playerList, 10);

    const headSize = 40;
    const framePadding = 10;
    const headGap = 12;
    const headsStartX = pingX + 110;
    const headsY = bottomY + 4;

    if (!isOnline || playerHeads.length === 0) {
        // Empty state
        ctx.font = '13px Arial, sans-serif';
        ctx.fillStyle = '#BBBBBB';
        ctx.textAlign = 'left';
        ctx.fillText(isOnline ? 'No players online' : 'Server offline', headsStartX, headsY + 28);
    } else {
        // Draw each player head in a Minecraft item frame
        for (let i = 0; i < playerHeads.length; i++) {
            const hx = headsStartX + i * (headSize + framePadding * 2 + headGap);
            const hy = headsY;

            // Don't overflow the card
            if (hx + headSize + framePadding * 2 > cX + cW - bottomPad) break;

            const { name, img } = playerHeads[i];

            // Draw Minecraft item frame
            drawItemFrame(ctx, hx, hy, headSize);

            // Draw player head inside frame
            ctx.save();
            ctx.beginPath(); rr(ctx, hx, hy, headSize, headSize, 2); ctx.clip();
            ctx.drawImage(img, hx, hy, headSize, headSize);
            ctx.restore();
        }

        // Show remaining count if more players
        const remaining = players.online - playerHeads.length;
        if (remaining > 0) {
            const lastHeadX = headsStartX + Math.min(playerHeads.length, Math.floor((cX + cW - bottomPad - headsStartX) / (headSize + framePadding * 2 + headGap))) * (headSize + framePadding * 2 + headGap);
            ctx.font = 'bold 14px Arial, sans-serif';
            ctx.fillStyle = '#888888';
            ctx.textAlign = 'left';
            ctx.fillText(`+${remaining}`, lastHeadX, headsY + headSize / 2 + 5);
        }
    }

    return canvas.toBuffer();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helper: Draw info card (Version / IP)
// ─────────────────────────────────────────────────────────────────────────────
function drawInfoCard(ctx, x, y, w, h, label, value, iconType) {
    // Card background
    ctx.fillStyle = '#F8F9FA';
    ctx.beginPath(); rr(ctx, x, y, w, h, 14); ctx.fill();

    // Card border
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); rr(ctx, x, y, w, h, 14); ctx.stroke();

    // Icon
    const iconX = x + 14;
    const iconY = y + h / 2;
    if (iconType === 'server') {
        drawServerMiniIcon(ctx, iconX, iconY, 12);
    } else {
        drawWifiIcon(ctx, iconX, iconY, 12);
    }

    // Label
    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = '#AAAAAA';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 38, y + 22);

    // Value
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillStyle = '#444444';
    const maxWidth = w - 48;
    let displayValue = value;
    if (ctx.measureText(value).width > maxWidth) {
        displayValue = value.substring(0, 16) + '...';
    }
    ctx.fillText(displayValue, x + 38, y + 44);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helper: Draw 3D cube icon
// ─────────────────────────────────────────────────────────────────────────────
function drawCubeIcon(ctx, cx, cy, s) {
    const topColor = '#6EC8F0';
    const leftColor = '#4AA8D8';
    const rightColor = '#3890C0';

    // Top face
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.86, cy - s * 0.5);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx - s * 0.86, cy - s * 0.5);
    ctx.closePath();
    ctx.fill();

    // Left face
    ctx.fillStyle = leftColor;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.86, cy - s * 0.5);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s * 0.86, cy + s * 0.5);
    ctx.closePath();
    ctx.fill();

    // Right face
    ctx.fillStyle = rightColor;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + s * 0.86, cy - s * 0.5);
    ctx.lineTo(cx + s * 0.86, cy + s * 0.5);
    ctx.lineTo(cx, cy + s);
    ctx.closePath();
    ctx.fill();

    // Edge lines
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.86, cy - s * 0.5);
    ctx.lineTo(cx + s * 0.86, cy + s * 0.5);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s * 0.86, cy + s * 0.5);
    ctx.lineTo(cx - s * 0.86, cy - s * 0.5);
    ctx.closePath();
    ctx.stroke();

    // Inner lines
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy);
    ctx.moveTo(cx + s * 0.86, cy - s * 0.5); ctx.lineTo(cx, cy);
    ctx.moveTo(cx - s * 0.86, cy - s * 0.5); ctx.lineTo(cx, cy);
    ctx.stroke();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helper: Draw people icon
// ─────────────────────────────────────────────────────────────────────────────
function drawPeopleIcon(ctx, x, y, size) {
    const s = size;
    ctx.fillStyle = '#888888';

    // Person 1 (front)
    ctx.beginPath();
    ctx.arc(x + s * 0.35, y + s * 0.3, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + s * 0.35, y + s * 0.75, s * 0.28, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Person 2 (back, slightly offset)
    ctx.fillStyle = '#AAAAAA';
    ctx.beginPath();
    ctx.arc(x + s * 0.65, y + s * 0.25, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + s * 0.65, y + s * 0.72, s * 0.25, s * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helper: Draw ping/activity icon
// ─────────────────────────────────────────────────────────────────────────────
function drawPingIcon(ctx, x, y, size) {
    const s = size;
    ctx.strokeStyle = '#66BB6A';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.7);
    ctx.lineTo(x + s * 0.25, y + s * 0.35);
    ctx.lineTo(x + s * 0.5, y + s * 0.55);
    ctx.lineTo(x + s * 0.75, y + s * 0.15);
    ctx.lineTo(x + s, y);
    ctx.stroke();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helper: Draw mini server icon
// ─────────────────────────────────────────────────────────────────────────────
function drawServerMiniIcon(ctx, cx, cy, size) {
    const s = size;

    // Two stacked rectangles
    ctx.fillStyle = '#5DDBF5';
    rr(ctx, cx - s, cy - s * 0.6, s * 2, s * 0.7, 3);
    ctx.fill();

    ctx.fillStyle = '#4FC3F7';
    rr(ctx, cx - s, cy + s * 0.1, s * 2, s * 0.7, 3);
    ctx.fill();

    // Dots on each
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(cx - s * 0.5, cy - s * 0.25, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx - s * 0.5, cy + s * 0.45, 2, 0, Math.PI * 2); ctx.fill();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helper: Draw wifi/signal icon
// ─────────────────────────────────────────────────────────────────────────────
function drawWifiIcon(ctx, cx, cy, size) {
    const s = size;
    ctx.strokeStyle = '#66BB6A';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Signal arcs
    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.3, s * 0.4, Math.PI, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.3, s * 0.7, Math.PI * 1.15, -0.15);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.3, s, Math.PI * 1.3, -0.3);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = '#66BB6A';
    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.3, 2, 0, Math.PI * 2);
    ctx.fill();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Export: updateServerStatus
// ─────────────────────────────────────────────────────────────────────────────
module.exports.updateServerStatus = async (client, server, settings) => {
    try {
        const status = await checkServerStatus(
            server.serverType === 'java' ? server.javaIP : server.bedrockIP,
            server.serverType === 'java' ? server.javaPort : server.bedrockPort,
            server.serverType
        );

        const imageBuffer = await generateStatusImage(
            server,
            status.data,
            settings.cardTemplate,
            settings.autoWallpaper
        );

        const attachment = new AttachmentBuilder(imageBuffer, { name: 'status.png' });
        const channel    = await client.channels.fetch(settings.statusChannelId);
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
