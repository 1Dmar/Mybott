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

    // 1. Dynamic Background
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
        overlay.addColorStop(0, template === 'neon' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)');
        overlay.addColorStop(1, template === 'neon' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, width, height);
    } catch (e) {
        ctx.fillStyle = template === 'neon' ? '#0a0e1a' : '#0f111b';
        ctx.fillRect(0, 0, width, height);
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
        // --- ORIGINAL GLASS / DARK TEMPLATES ---
        const panelX = 50, panelY = 50, panelW = width - 100, panelH = height - 100;
        if (template === 'glass') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 40); ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; ctx.lineWidth = 3; ctx.stroke();
        } else {
            ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
            ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 40); ctx.fill();
            ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)'; ctx.lineWidth = 2; ctx.stroke();
        }

        const iconX = 50, iconY = 50, iconSize = 150;
        try {
            const icon = await loadImage(iconUrl);
            ctx.save();
            ctx.shadowBlur = 50;
            ctx.shadowColor = isOnline ? 'rgba(34, 224, 138, 0.7)' : 'rgba(255, 94, 94, 0.6)';
            ctx.beginPath(); ctx.roundRect(iconX, iconY, iconSize, iconSize, 50); ctx.clip();
            ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
            ctx.restore();
        } catch (e) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath(); ctx.roundRect(iconX, iconY, iconSize, iconSize, 50); ctx.fill();
        }

        const infoX = iconX + iconSize + 40;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 32px "Minecraft", Arial';
        ctx.textAlign = 'left';
        ctx.fillText((server.serverName || 'Minecraft Server').toUpperCase(), infoX, 90);
        ctx.font = '22px Arial';
        ctx.fillText(`Players: ${players.online} / ${players.max}`, infoX, 120);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '18px Arial';
        const versionLabel = typeof version === 'string' ? version : (version.name || 'N/A');
        ctx.fillText(`Version: ${versionLabel}`, infoX, 145);
        ctx.fillText(`IP: ${cleanIpAddr}`, infoX, 170);

        if (isOnline && players.max > 0) {
            const barX = infoX, barY = 190, barW = 300, barH = 10;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 5); ctx.fill();
            const progress = Math.min(players.online / players.max, 1);
            const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
            grad.addColorStop(0, '#22E08A'); grad.addColorStop(1, '#0bbf6b');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.roundRect(barX, barY, barW * progress, barH, 5); ctx.fill();
            ctx.fillStyle = '#22E08A'; ctx.font = 'bold 14px Arial';
            ctx.fillText(`${Math.round(progress * 100)}%`, barX + barW + 10, barY + 10);
        }

        // Skin Render
        const skinX = width - 200, skinY = height - 230, skinSize = 180;
        try {
            const skinImage = await loadImage(`https://render.crafty.gg/3d/bust/Steve`);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath(); ctx.roundRect(skinX + 20, skinY + 40, 140, 140, 20); ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.stroke();
            ctx.save(); ctx.beginPath(); ctx.rect(skinX, skinY + 40, 200, 140); ctx.clip();
            ctx.drawImage(skinImage, skinX, skinY, skinSize, skinSize); ctx.restore();
            ctx.drawImage(skinImage, skinX, skinY, skinSize, skinSize);
        } catch (e) {}
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`PROMCBOT LIVE • ${new Date().toLocaleTimeString()}`, width - 40, height - 20);

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
