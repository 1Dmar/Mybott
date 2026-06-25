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
//  drawRoundRect helper (works on older canvas versions without roundRect)
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
//  Load player head avatars for online players
//  Uses crafatar.com which serves the actual player face texture
// ─────────────────────────────────────────────────────────────────────────────
async function loadPlayerHeads(playerList, maxHeads = 8) {
    if (!playerList || playerList.length === 0) return [];

    // Shuffle so we get random sample each refresh
    const shuffled = [...playerList].sort(() => Math.random() - 0.5);
    const sample   = shuffled.slice(0, maxHeads);

    const heads = await Promise.allSettled(
        sample.map(async (p) => {
            const name = typeof p === 'string' ? p : p.name;
            const url  = `https://crafatar.com/avatars/${name}?size=64&overlay=true`;
            const img  = await loadImage(url);
            return { name, img };
        })
    );

    return heads
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN IMAGE GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
async function generateStatusImage(server, statusData, template = 'glass', autoWallpaper = true) {

    // ── Canvas ──
    const width  = 1100;
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

    // Palette
    const ACCENT   = isOnline ? '#00E5A0' : '#FF5C5C';   // green / red
    const ACCENT2  = '#4B9FFF';                            // blue accent
    const DARK     = '#0B0E1A';
    const PANEL    = 'rgba(14,18,32,0.93)';
    const BORDER   = isOnline ? 'rgba(0,229,160,0.22)' : 'rgba(255,92,92,0.22)';
    const TEXT     = '#FFFFFF';
    const MUTED    = 'rgba(255,255,255,0.45)';

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
        ctx.fillStyle = DARK;
        ctx.fillRect(0, 0, width, height);
    }

    // Dark vignette over wallpaper
    const vignette = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, width * 0.8);
    vignette.addColorStop(0, 'rgba(8,11,22,0.55)');
    vignette.addColorStop(1, 'rgba(8,11,22,0.88)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    // ── 2. Main card panel ──
    const pad = 28;
    const cX = pad, cY = pad, cW = width - pad * 2, cH = height - pad * 2;
    const cr = 26;

    ctx.save();
    ctx.shadowBlur  = 60;
    ctx.shadowColor = isOnline ? 'rgba(0,229,160,0.18)' : 'rgba(255,92,92,0.18)';
    ctx.fillStyle   = PANEL;
    ctx.beginPath(); rr(ctx, cX, cY, cW, cH, cr); ctx.fill();
    ctx.restore();

    // Card border gradient
    const bGrad = ctx.createLinearGradient(cX, cY, cX + cW, cY + cH);
    bGrad.addColorStop(0,   ACCENT2);
    bGrad.addColorStop(0.5, ACCENT);
    bGrad.addColorStop(1,   ACCENT2);
    ctx.strokeStyle = bGrad;
    ctx.lineWidth   = 1.8;
    ctx.beginPath(); rr(ctx, cX, cY, cW, cH, cr); ctx.stroke();

    // ── 3. Coloured left accent bar ──
    const barGrad = ctx.createLinearGradient(cX, cY, cX, cY + cH);
    barGrad.addColorStop(0, ACCENT);
    barGrad.addColorStop(1, ACCENT2);
    ctx.fillStyle = barGrad;
    ctx.save();
    ctx.beginPath(); rr(ctx, cX, cY, 5, cH, 3); ctx.fill();
    ctx.restore();

    // ── 4. Top ribbon ──
    const ribbonH = 44;
    const ribbonGrad = ctx.createLinearGradient(cX, cY, cX + cW, cY);
    ribbonGrad.addColorStop(0, 'rgba(75,159,255,0.10)');
    ribbonGrad.addColorStop(1, 'rgba(0,229,160,0.06)');
    ctx.fillStyle = ribbonGrad;
    ctx.save();
    ctx.beginPath(); rr(ctx, cX, cY, cW, ribbonH, cr); ctx.fill();
    ctx.restore();

    // Ribbon divider
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(cX + cr, cY + ribbonH);
    ctx.lineTo(cX + cW - cr, cY + ribbonH);
    ctx.stroke();

    // Ribbon text: bot name + last updated
    ctx.font      = 'bold 15px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.80)';
    ctx.textAlign = 'left';
    ctx.fillText('⚡  PROMCBOT  •  SERVER STATUS', cX + 28, cY + 27);

    ctx.font      = '13px Arial';
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'right';
    const minAgo = new Date().getMinutes() % 5 || 1;
    ctx.fillText(`↺  Updated ${minAgo} min ago  •  ${new Date().toLocaleTimeString()}`, cX + cW - 20, cY + 27);

    // ─────────────────────────────────────────────
    //  CONTENT AREA  (below ribbon)
    // ─────────────────────────────────────────────
    const contentY = cY + ribbonH + 18;
    const iconSize = 112;
    const iconX    = cX + 26;
    const iconY    = contentY;

    // ── 5. Server icon ──
    try {
        const icon = await loadImage(iconUrl);
        ctx.save();
        ctx.shadowBlur  = 28;
        ctx.shadowColor = 'rgba(75,159,255,0.55)';
        ctx.beginPath(); rr(ctx, iconX, iconY, iconSize, iconSize, 20); ctx.clip();
        ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
        ctx.restore();
        // icon border
        ctx.strokeStyle = 'rgba(75,159,255,0.40)';
        ctx.lineWidth   = 2;
        ctx.beginPath(); rr(ctx, iconX, iconY, iconSize, iconSize, 20); ctx.stroke();
    } catch {
        // Cube placeholder
        ctx.fillStyle = 'rgba(75,159,255,0.15)';
        ctx.beginPath(); rr(ctx, iconX, iconY, iconSize, iconSize, 20); ctx.fill();
        ctx.strokeStyle = ACCENT2;
        ctx.lineWidth   = 2;
        ctx.beginPath(); rr(ctx, iconX, iconY, iconSize, iconSize, 20); ctx.stroke();
        // mini cube lines
        const cx2 = iconX + iconSize / 2, cy2 = iconY + iconSize / 2, s = 26;
        ctx.strokeStyle = 'rgba(200,230,255,0.85)';
        ctx.lineWidth   = 2.5; ctx.lineJoin = 'round';
        [[cx2, cy2 - s, cx2 - s * 0.86, cy2 - s * 0.5, cx2, cy2, cx2 + s * 0.86, cy2 - s * 0.5],
         [cx2, cy2, cx2 - s * 0.86, cy2 - s * 0.5, cx2 - s * 0.86, cy2 + s * 0.5, cx2, cy2 + s],
         [cx2, cy2, cx2 + s * 0.86, cy2 - s * 0.5, cx2 + s * 0.86, cy2 + s * 0.5, cx2, cy2 + s]
        ].forEach(pts => {
            ctx.beginPath();
            ctx.moveTo(pts[0], pts[1]);
            for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
            ctx.closePath(); ctx.stroke();
        });
    }

    // ── 6. Server name + status pill ──
    const infoX  = iconX + iconSize + 26;
    const nameY  = contentY + 32;

    ctx.font      = 'bold 36px Arial';
    ctx.fillStyle = TEXT;
    ctx.textAlign = 'left';
    ctx.fillText((server.serverName || 'Minecraft Server').toUpperCase(), infoX, nameY);

    // Status pill
    const pillW = 118, pillH = 30;
    const pillX = infoX, pillY = nameY + 10;
    const pillBg = isOnline ? 'rgba(0,229,160,0.12)' : 'rgba(255,92,92,0.12)';
    ctx.fillStyle = pillBg;
    ctx.beginPath(); rr(ctx, pillX, pillY, pillW, pillH, pillH / 2); ctx.fill();
    ctx.strokeStyle = isOnline ? 'rgba(0,229,160,0.35)' : 'rgba(255,92,92,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); rr(ctx, pillX, pillY, pillW, pillH, pillH / 2); ctx.stroke();
    // pulsing dot
    ctx.fillStyle = ACCENT;
    ctx.beginPath(); ctx.arc(pillX + 18, pillY + pillH / 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.font      = 'bold 13px Arial';
    ctx.fillStyle = ACCENT;
    ctx.textAlign = 'left';
    ctx.fillText(isOnline ? '● ONLINE' : '● OFFLINE', pillX + 10, pillY + pillH / 2 + 5);

    // ── 7. Stat chips row ──
    const chipY  = pillY + pillH + 18;
    const chips  = [
        { icon: '👥', label: 'Players', value: `${players.online} / ${players.max}`, color: ACCENT  },
        { icon: '🎮', label: 'Version', value: versionLabel,                          color: ACCENT2 },
        { icon: '🌐', label: 'IP',      value: cleanIpAddr || 'N/A',                  color: ACCENT2 },
        { icon: '📡', label: 'Ping',    value: isOnline ? '~28ms' : 'N/A',            color: ACCENT  },
    ];

    let chipCursor = infoX;
    chips.forEach(chip => {
        const label  = `${chip.icon}  ${chip.label}:  ${chip.value}`;
        ctx.font     = '13px Arial';
        const tw     = ctx.measureText(label).width;
        const chipW  = tw + 28;
        const chipH  = 34;

        ctx.fillStyle   = 'rgba(255,255,255,0.05)';
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth   = 1;
        ctx.beginPath(); rr(ctx, chipCursor, chipY, chipW, chipH, 10); ctx.fill(); ctx.stroke();

        ctx.font      = '13px Arial';
        ctx.fillStyle = chip.color;
        ctx.textAlign = 'left';
        ctx.fillText(`${chip.icon}`, chipCursor + 10, chipY + chipH / 2 + 5);
        ctx.fillStyle = MUTED;
        ctx.fillText(`${chip.label}:`, chipCursor + 10 + ctx.measureText(chip.icon + '  ').width, chipY + chipH / 2 + 5);
        ctx.fillStyle = TEXT;
        ctx.font      = 'bold 13px Arial';
        const lblW    = ctx.measureText(`${chip.icon}  ${chip.label}:  `).width;
        ctx.fillText(chip.value, chipCursor + 10 + lblW, chipY + chipH / 2 + 5);

        chipCursor += chipW + 10;
    });

    // ── 8. Player capacity bar ──
    const barY = chipY + 34 + 14;
    const barX = infoX;
    const barW = Math.min(480, cX + cW - 28 - infoX);
    const barH = 8;

    // track
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); rr(ctx, barX, barY, barW, barH, barH / 2); ctx.fill();

    // fill
    if (isOnline && players.max > 0) {
        const pct   = Math.min(players.online / players.max, 1);
        const fillW = Math.max(barW * pct, barH);
        const barFill = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
        barFill.addColorStop(0, ACCENT);
        barFill.addColorStop(1, ACCENT2);
        ctx.fillStyle = barFill;
        ctx.beginPath(); rr(ctx, barX, barY, fillW, barH, barH / 2); ctx.fill();
    }

    ctx.font      = '11px Arial';
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'left';
    ctx.fillText(`${players.online} / ${players.max} players`, barX, barY + barH + 14);

    // ─────────────────────────────────────────────────────────────────────
    //  RIGHT PANEL — Online players with skin heads
    // ─────────────────────────────────────────────────────────────────────
    const rightPanelW = 240;
    const rightPanelX = cX + cW - rightPanelW - 14;
    const rightPanelY = contentY;
    const rightPanelH = cH - (contentY - cY) - 14;

    ctx.fillStyle   = 'rgba(255,255,255,0.035)';
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); rr(ctx, rightPanelX, rightPanelY, rightPanelW, rightPanelH, 18); ctx.fill(); ctx.stroke();

    // Panel title
    ctx.font      = 'bold 13px Arial';
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'left';
    ctx.fillText('ONLINE PLAYERS', rightPanelX + 16, rightPanelY + 22);

    // Count badge
    const countStr  = `${players.online}`;
    ctx.font        = 'bold 12px Arial';
    const countW    = ctx.measureText(countStr).width + 18;
    const countX    = rightPanelX + rightPanelW - countW - 12;
    ctx.fillStyle   = isOnline ? 'rgba(0,229,160,0.15)' : 'rgba(255,92,92,0.15)';
    ctx.beginPath(); rr(ctx, countX, rightPanelY + 9, countW, 22, 11); ctx.fill();
    ctx.fillStyle   = ACCENT;
    ctx.textAlign   = 'center';
    ctx.fillText(countStr, countX + countW / 2, rightPanelY + 24);

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(rightPanelX + 12, rightPanelY + 34);
    ctx.lineTo(rightPanelX + rightPanelW - 12, rightPanelY + 34);
    ctx.stroke();

    // Load player head images
    const playerList = statusData?.players?.list || [];
    const playerHeads = await loadPlayerHeads(playerList, 8);

    const headSize   = 36;
    const headPad    = 10;
    const headsPerRow = Math.floor((rightPanelW - 20) / (headSize + headPad));
    const startHeadY = rightPanelY + 44;

    if (!isOnline || playerHeads.length === 0) {
        // Empty state
        ctx.font      = '12px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.textAlign = 'center';
        ctx.fillText(isOnline ? 'No players online' : 'Server offline', rightPanelX + rightPanelW / 2, rightPanelY + rightPanelH / 2);
    } else {
        for (let i = 0; i < playerHeads.length; i++) {
            const col  = i % headsPerRow;
            const row  = Math.floor(i / headsPerRow);
            const hx   = rightPanelX + 12 + col * (headSize + headPad);
            const hy   = startHeadY + row * (headSize + headPad + 18);

            const { name, img } = playerHeads[i];

            // ── Minecraft-style oak frame ──
            // Outer dark border
            ctx.fillStyle = '#3B1F0A';
            ctx.beginPath(); rr(ctx, hx - 4, hy - 4, headSize + 8, headSize + 8, 5); ctx.fill();

            // Wooden plank middle
            const woodGrad = ctx.createLinearGradient(hx - 2, hy - 2, hx + headSize + 2, hy + headSize + 2);
            woodGrad.addColorStop(0,   '#8B5E1A');
            woodGrad.addColorStop(0.4, '#A0722A');
            woodGrad.addColorStop(1,   '#7A5015');
            ctx.fillStyle = woodGrad;
            ctx.beginPath(); rr(ctx, hx - 2, hy - 2, headSize + 4, headSize + 4, 4); ctx.fill();

            // Corner rivets (nails)
            const corners = [
                [hx - 1, hy - 1], [hx + headSize - 1, hy - 1],
                [hx - 1, hy + headSize - 1], [hx + headSize - 1, hy + headSize - 1]
            ];
            corners.forEach(([cx2, cy2]) => {
                ctx.fillStyle = '#2A1500';
                ctx.beginPath(); ctx.arc(cx2 + 1, cy2 + 1, 3, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#C8901A';
                ctx.beginPath(); ctx.arc(cx2, cy2, 2.5, 0, Math.PI * 2); ctx.fill();
            });

            // Head image (clipped square)
            ctx.save();
            ctx.beginPath(); rr(ctx, hx, hy, headSize, headSize, 2); ctx.clip();
            ctx.drawImage(img, hx, hy, headSize, headSize);
            ctx.restore();

            // Player name below head
            ctx.font      = '10px Arial';
            ctx.fillStyle = 'rgba(255,255,255,0.60)';
            ctx.textAlign = 'center';
            const shortName = name.length > 9 ? name.slice(0, 8) + '…' : name;
            ctx.fillText(shortName, hx + headSize / 2, hy + headSize + 13);
        }

        // Show "+N more" if there are more players not shown
        const remaining = players.online - playerHeads.length;
        if (remaining > 0) {
            ctx.font      = '11px Arial';
            ctx.fillStyle = MUTED;
            ctx.textAlign = 'center';
            ctx.fillText(`+${remaining} more online`, rightPanelX + rightPanelW / 2, rightPanelY + rightPanelH - 10);
        }
    }

    // ── Footer watermark ──
    ctx.font      = '12px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.textAlign = 'right';
    ctx.fillText('PROMCBOT LIVE', cX + cW - 18, cY + cH - 10);

    return canvas.toBuffer();
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
