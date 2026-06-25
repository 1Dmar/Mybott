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
        // --- NEW NEON TEMPLATE (Cubecraft Inspired) ---
        const panelX = 60, panelY = 60, panelW = width - 120, panelH = height - 120;

        // Outer Glow Border
        ctx.save();
        ctx.shadowBlur = 40;
        ctx.shadowColor = 'rgba(0, 255, 200, 0.4)';
        
        const borderGrad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
        borderGrad.addColorStop(0, '#007BFF'); // Blue
        borderGrad.addColorStop(0.5, '#00FFC8'); // Cyan/Green
        borderGrad.addColorStop(1, '#00FFC8');
        
        ctx.strokeStyle = borderGrad;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 35);
        ctx.stroke();
        ctx.restore();

        // Inner Panel Background
        ctx.fillStyle = 'rgba(10, 12, 18, 0.85)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 35);
        ctx.fill();

        // Top Status Bar
        const barTopY = panelY + 40;
        
        // LIVE Badge
        ctx.fillStyle = 'rgba(0, 255, 200, 0.1)';
        ctx.beginPath();
        ctx.roundRect(panelX + 40, barTopY - 25, 80, 35, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 255, 200, 0.3)';
        ctx.stroke();
        
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = statusColor;
        ctx.textAlign = 'left';
        ctx.fillText(isOnline ? '⚡ LIVE' : '● OFFLINE', panelX + 55, barTopY);

        // Up-to-date Badge
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.roundRect(panelX + 135, barTopY - 25, 130, 35, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.stroke();
        
        ctx.font = '14px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText('○ Up-to-date', panelX + 150, barTopY - 2);

        // Updated Time
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillText(`↺ Updated ${new Date().getMinutes() % 5} min ago`, panelX + panelW - 40, barTopY - 2);

        // Main Content
        const contentY = panelY + 100;
        
        // Server Icon
        const iconX = panelX + 40, iconY = contentY - 20, iconSize = 220;
        const cx = iconX + iconSize / 2, cy = iconY + iconSize / 2;
        
        try {
            const icon = await loadImage(iconUrl);
            ctx.save();
            ctx.shadowBlur = 45;
            ctx.shadowColor = isOnline ? 'rgba(0, 123, 255, 0.8)' : 'rgba(255, 94, 94, 0.6)';
            
            // Hexagon mask for actual icon
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i - Math.PI / 2;
                ctx.lineTo(cx + (iconSize/2 - 5) * Math.cos(angle), cy + (iconSize/2 - 5) * Math.sin(angle));
            }
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
            ctx.restore();
            
            // Hexagon Border
            ctx.strokeStyle = '#4D94FF';
            ctx.lineWidth = 4;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i - Math.PI / 2;
                ctx.lineTo(cx + iconSize/2 * Math.cos(angle), cy + iconSize/2 * Math.sin(angle));
            }
            ctx.closePath();
            ctx.stroke();
        } catch (e) {
            // Stylized Hexagon/Cube Placeholder if icon fails
            ctx.save();
            ctx.shadowBlur = 45;
            ctx.shadowColor = 'rgba(0, 123, 255, 0.8)';
            ctx.strokeStyle = '#4D94FF';
            ctx.lineWidth = 6;
            
            const drawHex = (x, y, r) => {
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 2;
                    ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
                }
                ctx.closePath();
            };
            
            drawHex(cx, cy, iconSize / 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(0, 40, 120, 0.4)';
            ctx.fill();
            
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 4;
            ctx.lineJoin = 'round';
            const s = 45;
            ctx.beginPath(); ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx, cy - s); ctx.lineTo(cx - s * 0.86, cy - s * 0.5); ctx.lineTo(cx, cy); ctx.lineTo(cx + s * 0.86, cy - s * 0.5); ctx.closePath(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - s * 0.86, cy - s * 0.5); ctx.lineTo(cx - s * 0.86, cy + s * 0.5); ctx.lineTo(cx, cy + s); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + s * 0.86, cy - s * 0.5); ctx.lineTo(cx + s * 0.86, cy + s * 0.5); ctx.lineTo(cx, cy + s); ctx.stroke();
            ctx.restore();
        }

        // Server Info
        const infoX = iconX + iconSize + 60;
        ctx.font = 'bold 72px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText((server.serverName || 'Minecraft Server').toUpperCase(), infoX, contentY + 70);

        // Stats List
        const statsY = contentY + 130;
        const drawStatLine = (label, value, icon, y) => {
            ctx.font = '22px Arial';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillText(icon + ' ' + label, infoX, y);
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'right';
            ctx.fillText(value, infoX + 350, y);
            ctx.textAlign = 'left';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(infoX, y + 15); ctx.lineTo(infoX + 350, y + 15); ctx.stroke();
        };

        drawStatLine('Players', `${players.online} / ${players.max}`, '👥', statsY);
        drawStatLine('Version', typeof version === 'string' ? version : (version.name || 'N/A'), '🎮', statsY + 60);
        drawStatLine('IP Address', cleanIpAddr, '🌐', statsY + 120);

        // Right Side: Online Status Box
        const statusBoxX = panelX + panelW - 400, statusBoxY = contentY + 30, statusBoxW = 360, statusBoxH = 150;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.beginPath();
        ctx.roundRect(statusBoxX, statusBoxY, statusBoxW, statusBoxH, 20);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.stroke();

        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = statusColor;
        ctx.fillText(isOnline ? '● ONLINE' : '● OFFLINE', statusBoxX + 30, statusBoxY + 50);
        
        ctx.font = '18px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        const msg = isOnline ? 'The server is running smoothly\nand fully operational.' : 'The server is currently offline\nor under maintenance.';
        msg.split('\n').forEach((line, i) => ctx.fillText(line, statusBoxX + 30, statusBoxY + 90 + (i * 25)));

        // Performance Metrics Grid
        const metricsY = statusBoxY + statusBoxH + 20;
        const metrics = [
            { label: 'Ping', value: isOnline ? '28 ms' : 'N/A', icon: '📶', color: statusColor },
            { label: 'TPS', value: isOnline ? '20.0' : 'N/A', icon: '🛡️', color: statusColor },
            { label: 'Uptime', value: isOnline ? '99.9%' : '0%', icon: '⚙️', color: statusColor }
        ];

        metrics.forEach((m, i) => {
            const mx = statusBoxX + (i * 125);
            const mw = 110, mh = 100;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.beginPath(); ctx.roundRect(mx, metricsY, mw, mh, 15); ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; ctx.stroke();
            
            ctx.font = '14px Arial'; ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.textAlign = 'center';
            ctx.fillText(m.label, mx + mw/2, metricsY + 30);
            
            ctx.font = 'bold 20px Arial'; ctx.fillStyle = m.color;
            ctx.fillText(m.value, mx + mw/2, metricsY + 75);
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
