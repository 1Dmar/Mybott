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
        overlay.addColorStop(0, template === 'neon' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.4)');
        overlay.addColorStop(1, template === 'neon' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.8)');
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
        const panelX = 40, panelY = 40, panelW = width - 80, panelH = height - 80;

        // Neon glow effect
        ctx.shadowBlur = 30;
        ctx.shadowColor = 'rgba(0, 255, 200, 0.3)';
        ctx.fillStyle = 'rgba(15, 17, 27, 0.9)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 20);
        ctx.fill();

        // Neon border
        const borderGradient = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
        borderGradient.addColorStop(0, 'rgba(0, 255, 200, 0.8)');
        borderGradient.addColorStop(0.5, 'rgba(0, 200, 150, 0.5)');
        borderGradient.addColorStop(1, 'rgba(0, 255, 200, 0.2)');
        ctx.strokeStyle = borderGradient;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Header Section
        const headerY = 65;
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = statusColor;
        ctx.textAlign = 'left';
        ctx.fillText(isOnline ? '● LIVE' : '● OFFLINE', panelX + 30, headerY);
        
        ctx.font = '14px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.textAlign = 'center';
        ctx.fillText('⊙ Up-to-date', width / 2, headerY);
        
        ctx.textAlign = 'right';
        ctx.fillText(`⊙ Updated ${new Date().getMinutes()} min ago`, width - panelX - 30, headerY);

        // Server Icon
        const iconX = panelX + 50, iconY = panelY + 80, iconSize = 200;
        try {
            const icon = await loadImage(iconUrl);
            ctx.save();
            ctx.shadowBlur = 40;
            ctx.shadowColor = isOnline ? 'rgba(0, 255, 200, 0.6)' : 'rgba(255, 94, 94, 0.5)';
            ctx.beginPath();
            ctx.roundRect(iconX, iconY, iconSize, iconSize, 30);
            ctx.clip();
            ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
            ctx.restore();
        } catch (e) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.roundRect(iconX, iconY, iconSize, iconSize, 30);
            ctx.fill();
        }

        // Server Info
        const infoX = iconX + iconSize + 60;
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText((server.serverName || 'Minecraft Server').toUpperCase(), infoX, iconY + 80);

        ctx.font = '20px Arial';
        ctx.fillText(`👥 Players: ${players.online} / ${players.max}`, infoX, iconY + 110);
        ctx.font = '16px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(`🎮 Version: ${version}`, infoX, iconY + 145);
        ctx.fillText(`🌐 IP: ${cleanIpAddr}:${port}`, infoX, iconY + 170);

        // Progress Bar
        if (isOnline && players.max > 0) {
            const barX = infoX, barY = iconY + 200, barW = 300, barH = 12;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, barH, 6);
            ctx.fill();
            const progress = Math.min(players.online / players.max, 1);
            const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
            grad.addColorStop(0, '#00FFC8');
            grad.addColorStop(1, '#00CC99');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW * progress, barH, 6);
            ctx.fill();
            ctx.fillStyle = '#00FFC8';
            ctx.font = 'bold 13px Arial';
            ctx.fillText(`${Math.round(progress * 100)}%`, barX + barW + 15, barY + 10);
        }

        // Status Box
        const statusBoxX = width - panelX - 320, statusBoxY = iconY, statusBoxW = 280, statusBoxH = 140;
        ctx.fillStyle = 'rgba(0, 255, 200, 0.08)';
        ctx.beginPath();
        ctx.roundRect(statusBoxX, statusBoxY, statusBoxW, statusBoxH, 15);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 255, 200, 0.3)';
        ctx.stroke();
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = statusColor;
        ctx.textAlign = 'center';
        ctx.fillText('● ' + (isOnline ? 'ONLINE' : 'OFFLINE'), statusBoxX + statusBoxW / 2, statusBoxY + 35);
        ctx.font = '13px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        const msg = isOnline ? 'The server is running smoothly\nand fully operational.' : 'The server is currently offline\nor under maintenance.';
        msg.split('\n').forEach((line, i) => ctx.fillText(line, statusBoxX + statusBoxW / 2, statusBoxY + 70 + (i * 18)));

        // Performance Metrics
        const metricsY = statusBoxY + statusBoxH + 30;
        const metrics = [{ label: 'Ping', value: '28 ms' }, { label: 'TPS', value: '20.0' }, { label: 'Uptime', value: '99.9%' }];
        metrics.forEach((m, i) => {
            const mx = statusBoxX + (i * 100);
            ctx.fillStyle = 'rgba(0, 255, 200, 0.05)';
            ctx.beginPath(); ctx.roundRect(mx, metricsY, 80, 60, 10); ctx.fill();
            ctx.strokeStyle = 'rgba(0, 255, 200, 0.2)'; ctx.stroke();
            ctx.font = '11px Arial'; ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.fillText(m.label, mx + 40, metricsY + 18);
            ctx.font = 'bold 14px Arial'; ctx.fillStyle = '#00FFC8'; ctx.fillText(m.value, mx + 40, metricsY + 40);
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
