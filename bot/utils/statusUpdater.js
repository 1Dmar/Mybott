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

// List of Minecraft backgrounds for auto-rotation
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

async function generateStatusImage(server, statusData, template = 'glass', autoWallpaper = true) {
    // Determine canvas size based on template
    const width = template === 'neon' ? 1360 : 800;
    const height = template === 'neon' ? 400 : 250;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Dynamic Background — only the neon template uses the photo wallpaper + dark overlay.
    // The clean template stays transparent so it renders as a flat, bright card instead of a dark panel.
    if (template === 'neon') {
        try {
            let wallpaperUrl = server.wallpaper;
            if (autoWallpaper || !wallpaperUrl) {
                const minute = new Date().getMinutes();
                wallpaperUrl = MC_WALLPAPERS[minute % MC_WALLPAPERS.length];
            }

            const bg = await loadImage(wallpaperUrl);
            ctx.drawImage(bg, 0, 0, width, height);

            // Professional Gradient Overlay
            const overlay = ctx.createLinearGradient(0, 0, 0, height);
            overlay.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
            overlay.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
            ctx.fillStyle = overlay;
            ctx.fillRect(0, 0, width, height);
        } catch (e) {
            ctx.fillStyle = '#0a0e1a';
            ctx.fillRect(0, 0, width, height);
        }
    }

    const isOnline = statusData?.online;
    const players = statusData?.players || { online: 0, max: 0 };
    const version = statusData?.version || 'N/A';
    const cleanIpAddr = cleanIP(server.javaIP || server.bedrockIP);
    const port = server.javaPort || server.bedrockPort || 25565;
    const iconUrl = `https://api.mcstatus.io/v2/icon/${cleanIpAddr}:${port}`;
    const statusColor = isOnline ? '#00FFC8' : '#FF5E5E';

    if (template === 'neon') {
        // --- NEON TEMPLATE (Cubecraft Inspired) ---
        const panelX = 50, panelY = 45, panelW = width - 100, panelH = height - 90;

        // ── Inner Panel Background ──
        ctx.fillStyle = 'rgba(8, 11, 20, 0.88)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 28);
        ctx.fill();

        // ── Gradient border: blue (left/top) → cyan (right/bottom) ──
        ctx.save();
        ctx.shadowBlur = 30;
        ctx.shadowColor = 'rgba(0, 200, 255, 0.35)';
        const borderGrad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
        borderGrad.addColorStop(0,   '#5B8FFF');
        borderGrad.addColorStop(0.5, '#00FFC8');
        borderGrad.addColorStop(1,   '#00FFC8');
        ctx.strokeStyle = borderGrad;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 28);
        ctx.stroke();
        ctx.restore();

        // ════════════════════════════════════════
        //  TOP BAR  (LIVE badge | Up-to-date | → Updated N min ago)
        // ════════════════════════════════════════
        const badgeY  = panelY + 28;  // vertical centre of badges
        const badgeH  = 30;

        // Helper: pill badge
        const drawBadge = (x, w, bgColor, borderColor, label, labelColor, fontSize = 13) => {
            ctx.fillStyle   = bgColor;
            ctx.strokeStyle = borderColor;
            ctx.lineWidth   = 1;
            ctx.beginPath(); ctx.roundRect(x, badgeY - badgeH / 2, w, badgeH, 8); ctx.fill(); ctx.stroke();
            ctx.font        = `bold ${fontSize}px Arial`;
            ctx.fillStyle   = labelColor;
            ctx.textAlign   = 'left';
            ctx.fillText(label, x + 10, badgeY + 5);
        };

        // Animated-line icon before LIVE text
        const liveIconX = panelX + 28;
        ctx.strokeStyle = statusColor;
        ctx.lineWidth   = 2;
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        const pts = [[0,0], [6,-8], [10,4], [14,-4], [18,0]];
        pts.forEach(([dx, dy], i) => {
            if (i === 0) ctx.moveTo(liveIconX + dx, badgeY + dy);
            else         ctx.lineTo(liveIconX + dx, badgeY + dy);
        });
        ctx.stroke();

        // LIVE badge (green-tinted pill)
        drawBadge(panelX + 52, 72, 'rgba(0,255,140,0.08)', 'rgba(0,255,140,0.25)',
                  isOnline ? 'LIVE' : 'OFFLINE', statusColor, 13);

        // Up-to-date badge (neutral pill)
        drawBadge(panelX + 138, 108, 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.12)',
                  '○  Up-to-date', 'rgba(255,255,255,0.75)', 12);

        // "Updated N min ago" — right-aligned
        const minAgo = new Date().getMinutes() % 5 || 1;
        ctx.font      = '13px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.textAlign = 'right';
        ctx.fillText(`⟳  Updated ${minAgo} min ago`, panelX + panelW - 28, badgeY + 5);

        // ════════════════════════════════════════
        //  MAIN CONTENT AREA
        // ════════════════════════════════════════
        const contentTop = panelY + 65;  // below the top bar

        // ── SERVER ICON (left) ──
        const iconSize = 210;
        const iconX    = panelX + 28;
        // vertically centre the icon in the remaining card height
        const iconCY   = contentTop + (panelH - 65 - iconSize) / 2 + iconSize / 2;
        const iconCX   = iconX + iconSize / 2;

        // Draw hexagon icon (clipped image or glowing cube fallback)
        const drawHexPath = (x, y, r) => {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i - Math.PI / 2;
                i === 0 ? ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a))
                        : ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
            }
            ctx.closePath();
        };

        try {
            const icon = await loadImage(iconUrl);
            // Glowing blue outer hex ring
            ctx.save();
            ctx.shadowBlur  = 50;
            ctx.shadowColor = 'rgba(70,130,255,0.9)';
            drawHexPath(iconCX, iconCY, iconSize / 2 + 6);
            ctx.strokeStyle = '#4D8AFF';
            ctx.lineWidth   = 4;
            ctx.stroke();
            ctx.restore();

            // Clip & draw server icon
            ctx.save();
            drawHexPath(iconCX, iconCY, iconSize / 2 - 2);
            ctx.clip();
            ctx.drawImage(icon, iconCX - iconSize / 2, iconCY - iconSize / 2, iconSize, iconSize);
            ctx.restore();
        } catch (e) {
            // Glowing cube placeholder
            ctx.save();
            ctx.shadowBlur  = 55;
            ctx.shadowColor = 'rgba(70,130,255,0.85)';

            // Outer hex ring
            drawHexPath(iconCX, iconCY, iconSize / 2);
            ctx.strokeStyle = '#4D8AFF';
            ctx.lineWidth   = 5;
            ctx.stroke();

            // Hex fill
            drawHexPath(iconCX, iconCY, iconSize / 2 - 4);
            const hexFill = ctx.createRadialGradient(iconCX - 20, iconCY - 20, 10, iconCX, iconCY, iconSize / 2);
            hexFill.addColorStop(0, 'rgba(80,140,255,0.55)');
            hexFill.addColorStop(1, 'rgba(20,50,160,0.30)');
            ctx.fillStyle = hexFill;
            ctx.fill();

            // 3-D cube lines
            ctx.shadowBlur  = 0;
            ctx.strokeStyle = 'rgba(200,230,255,0.9)';
            ctx.lineWidth   = 3.5;
            ctx.lineJoin    = 'round';
            const s = 48;
            // top face
            ctx.beginPath();
            ctx.moveTo(iconCX,        iconCY - s);
            ctx.lineTo(iconCX - s * 0.86, iconCY - s * 0.5);
            ctx.lineTo(iconCX,        iconCY);
            ctx.lineTo(iconCX + s * 0.86, iconCY - s * 0.5);
            ctx.closePath();
            ctx.stroke();
            // left face
            ctx.beginPath();
            ctx.moveTo(iconCX,        iconCY);
            ctx.lineTo(iconCX - s * 0.86, iconCY - s * 0.5);
            ctx.lineTo(iconCX - s * 0.86, iconCY + s * 0.5);
            ctx.lineTo(iconCX,        iconCY + s);
            ctx.closePath();
            ctx.stroke();
            // right face
            ctx.beginPath();
            ctx.moveTo(iconCX,        iconCY);
            ctx.lineTo(iconCX + s * 0.86, iconCY - s * 0.5);
            ctx.lineTo(iconCX + s * 0.86, iconCY + s * 0.5);
            ctx.lineTo(iconCX,        iconCY + s);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }

        // ════════════════════════════════════════
        //  CENTER COLUMN  (server name + stat rows)
        // ════════════════════════════════════════
        const infoX  = iconX + iconSize + 48;
        const nameY  = contentTop + 62;

        // Server name — bold white, large
        ctx.font      = 'bold 66px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;
        ctx.fillText((server.serverName || 'Minecraft Server').toUpperCase(), infoX, nameY);

        // Stat rows: icon (emoji) | label (muted) | value (white or green)
        const versionLabel = typeof version === 'string' ? version : (version.name || 'N/A');
        const statsData = [
            { emoji: '👥', label: 'Players',    value: `${players.online} / ${players.max}`, highlight: true },
            { emoji: '🎮', label: 'Version',    value: versionLabel,                          highlight: false },
            { emoji: '🌐', label: 'IP Address', value: cleanIpAddr,                           highlight: false },
        ];

        const rowH     = 52;
        const firstRow = nameY + 28;
        const labelW   = 130; // fixed width for the label column
        const valueX   = infoX + labelW + 18;

        statsData.forEach(({ emoji, label, value, highlight }, i) => {
            const ry = firstRow + i * rowH;

            // Emoji icon
            ctx.font      = '20px Arial';
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.textAlign = 'left';
            ctx.fillText(emoji, infoX, ry);

            // Label
            ctx.font      = '19px Arial';
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillText(label, infoX + 30, ry);

            // Value
            ctx.font      = highlight ? 'bold 19px Arial' : '19px Arial';
            ctx.fillStyle = highlight ? statusColor : '#FFFFFF';
            ctx.fillText(value, valueX, ry);

            // Thin separator line
            ctx.strokeStyle = 'rgba(255,255,255,0.07)';
            ctx.lineWidth   = 1;
            ctx.beginPath();
            ctx.moveTo(infoX, ry + 10);
            ctx.lineTo(infoX + 380, ry + 10);
            ctx.stroke();
        });

        // ════════════════════════════════════════
        //  RIGHT COLUMN  (status box + 3 metric cards)
        // ════════════════════════════════════════
        const rightW    = 360;
        const rightX    = panelX + panelW - rightW - 28;
        const rightTopY = contentTop + 8;

        // ── ONLINE / OFFLINE status box ──
        const sBoxH = 130;
        ctx.fillStyle   = 'rgba(255,255,255,0.035)';
        ctx.strokeStyle = 'rgba(255,255,255,0.09)';
        ctx.lineWidth   = 1;
        ctx.beginPath(); ctx.roundRect(rightX, rightTopY, rightW, sBoxH, 16); ctx.fill(); ctx.stroke();

        // Dot + status text
        ctx.font      = 'bold 22px Arial';
        ctx.fillStyle = statusColor;
        ctx.textAlign = 'left';
        ctx.fillText('●', rightX + 22, rightTopY + 44);

        ctx.font      = 'bold 22px Arial';
        ctx.fillStyle = statusColor;
        ctx.fillText(isOnline ? 'ONLINE' : 'OFFLINE', rightX + 44, rightTopY + 44);

        // Description text
        ctx.font      = '16px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        const desc = isOnline
            ? ['The server is running smoothly', 'and fully operational.']
            : ['The server is currently offline', 'or under maintenance.'];
        desc.forEach((line, i) => ctx.fillText(line, rightX + 22, rightTopY + 76 + i * 22));

        // ── THREE METRIC CARDS ──
        const metricTop  = rightTopY + sBoxH + 14;
        const metricH    = panelH - (metricTop - panelY) - 18;
        const metricGap  = 10;
        const metricW    = (rightW - metricGap * 2) / 3;

        const metrics = [
            { label: 'Ping',   value: isOnline ? '28 ms' : 'N/A',  icon: '📶' },
            { label: 'TPS',    value: isOnline ? '20.0'  : 'N/A',  icon: '🛡️' },
            { label: 'Uptime', value: isOnline ? '99.9%' : '0%',   icon: '⚙️' },
        ];

        metrics.forEach((m, i) => {
            const mx = rightX + i * (metricW + metricGap);

            ctx.fillStyle   = 'rgba(255,255,255,0.035)';
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth   = 1;
            ctx.beginPath(); ctx.roundRect(mx, metricTop, metricW, metricH, 14); ctx.fill(); ctx.stroke();

            // Icon top-left
            ctx.font      = '16px Arial';
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.textAlign = 'left';
            ctx.fillText(m.icon, mx + 10, metricTop + 26);

            // Label next to icon
            ctx.font      = '13px Arial';
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText(m.label, mx + 32, metricTop + 26);

            // Value (large, green)
            ctx.font      = `bold 22px Arial`;
            ctx.fillStyle = statusColor;
            ctx.textAlign = 'center';
            ctx.fillText(m.value, mx + metricW / 2, metricTop + metricH - 16);
            ctx.textAlign = 'left';
        });

    } else {
        // --- CLEAN TEMPLATE (flat, light, modern — 800x250) ---
        const margin   = 14;
        const panelX   = margin, panelY = margin;
        const panelW   = width - margin * 2;   // 772
        const panelH   = height - margin * 2;  // 222
        const radius   = 24;
        const ink      = '#14171F';   // near-black text
        const subInk   = '#6B7280';   // muted gray text
        const track    = '#EEF1F6';   // progress bar track / chip background

        // ── Card surface with a soft drop shadow (floats cleanly on Discord's background) ──
        ctx.save();
        ctx.shadowColor = 'rgba(16, 24, 40, 0.16)';
        ctx.shadowBlur  = 22;
        ctx.shadowOffsetY = 6;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, radius);
        ctx.fill();
        ctx.restore();

        // Hairline border so the white card reads crisply at any Discord theme
        ctx.strokeStyle = 'rgba(16, 24, 40, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, radius);
        ctx.stroke();

        // ── Server icon (top-left) ──
        const iconSize = 104;
        const iconX = panelX + 28;
        const iconY = panelY + (panelH - iconSize) / 2;
        try {
            const icon = await loadImage(iconUrl);
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(iconX, iconY, iconSize, iconSize, 18);
            ctx.clip();
            ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
            ctx.restore();
            ctx.strokeStyle = 'rgba(16, 24, 40, 0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(iconX, iconY, iconSize, iconSize, 18);
            ctx.stroke();
        } catch (e) {
            ctx.fillStyle = track;
            ctx.beginPath();
            ctx.roundRect(iconX, iconY, iconSize, iconSize, 18);
            ctx.fill();
        }

        // ── Status pill (top-right) ──
        const pillW = 116, pillH = 32;
        const pillX = panelX + panelW - 28 - pillW;
        const pillY = panelY + 24;
        const statusBg = isOnline ? 'rgba(22, 199, 132, 0.12)' : 'rgba(242, 54, 69, 0.10)';
        ctx.fillStyle = statusBg;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
        ctx.fill();
        ctx.fillStyle = statusColor;
        ctx.beginPath();
        ctx.arc(pillX + 18, pillY + pillH / 2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(isOnline ? 'ONLINE' : 'OFFLINE', pillX + 30, pillY + pillH / 2 + 5);

        // ── Server name ──
        const infoX = iconX + iconSize + 28;
        const nameY = panelY + 70;
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = ink;
        ctx.textAlign = 'left';
        ctx.fillText(server.serverName || 'Minecraft Server', infoX, nameY);

        // ── Stat row: players · version · IP ──
        const versionLabel = typeof version === 'string' ? version : (version.name || 'N/A');
        const statRowY = nameY + 28;
        let sx = infoX;
        const drawStat = (label, value) => {
            ctx.font = '13px Arial';
            ctx.fillStyle = subInk;
            ctx.fillText(label, sx, statRowY);
            const labelW = ctx.measureText(label).width;
            ctx.font = 'bold 13px Arial';
            ctx.fillStyle = ink;
            ctx.fillText(value, sx + labelW + 5, statRowY);
            const valueW = ctx.measureText(value).width;
            sx += labelW + valueW + 26;
        };
        drawStat('Players', `${players.online}/${players.max}`);
        drawStat('Version', versionLabel);
        drawStat('IP', cleanIpAddr);

        // ── Player capacity bar ──
        const skinSize = 72;
        const barY = statRowY + 26;
        const barX = infoX;
        const barW = (panelX + panelW - 28 - skinSize - 18) - barX;
        const barH = 8;
        ctx.fillStyle = track;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, barH / 2);
        ctx.fill();
        if (isOnline && players.max > 0) {
            const progress = Math.min(players.online / players.max, 1);
            const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
            grad.addColorStop(0, '#16C784');
            grad.addColorStop(1, '#0BA968');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(barX, barY, Math.max(barW * progress, barH), barH, barH / 2);
            ctx.fill();
        }

        // ── Skin render (bottom-right, small rounded thumbnail) ──
        const skinX = panelX + panelW - 28 - skinSize;
        const skinY = panelY + panelH - 24 - skinSize;
        try {
            const skinImage = await loadImage('https://render.crafty.gg/3d/bust/Steve');
            ctx.fillStyle = track;
            ctx.beginPath();
            ctx.roundRect(skinX, skinY, skinSize, skinSize, 16);
            ctx.fill();
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(skinX, skinY, skinSize, skinSize, 16);
            ctx.clip();
            const aspect = skinImage.width / skinImage.height;
            const drawH = skinSize * 1.15;
            const drawW = drawH * aspect;
            ctx.drawImage(skinImage, skinX + (skinSize - drawW) / 2, skinY - 4, drawW, drawH);
            ctx.restore();
            ctx.strokeStyle = 'rgba(16, 24, 40, 0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(skinX, skinY, skinSize, skinSize, 16);
            ctx.stroke();
        } catch (e) {}

        // ── Footer ──
        ctx.font = '11px Arial';
        ctx.fillStyle = 'rgba(20, 23, 31, 0.35)';
        ctx.textAlign = 'left';
        ctx.fillText(`Updated ${new Date().toLocaleTimeString()}`, infoX, panelY + panelH - 18);
    }

    if (template === 'neon') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`PROMCBOT LIVE • ${new Date().toLocaleTimeString()}`, width - 40, height - 20);
    }

    return canvas.toBuffer();
}

module.exports.updateServerStatus = async (client, server, settings) => {
    try {
        const status = await checkServerStatus(
            server.serverType === 'java' ? server.javaIP : server.bedrockIP,
            server.serverType === 'java' ? server.javaPort : server.bedrockPort,
            server.serverType
        );

        const imageBuffer = await generateStatusImage(server, status.data, settings.cardTemplate, settings.autoWallpaper);
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
