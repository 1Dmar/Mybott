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
    "https://i.ibb.co/6R8mH699/3.png",
    "https://i.ibb.co/m58pLp8H/4.png",
    "https://i.ibb.co/8LpYvL8H/5.png",
    "https://i.ibb.co/Xf8YvL8H/6.png"
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
    // Large Card Design
    const width = 1000;
    const height = 450;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Dynamic Background
    try {
        let wallpaperUrl = server.wallpaper;
        if (autoWallpaper || !wallpaperUrl) {
            // Pick a random wallpaper or based on minute
            const minute = new Date().getMinutes();
            wallpaperUrl = MC_WALLPAPERS[minute % MC_WALLPAPERS.length];
        }

        const bg = await loadImage(wallpaperUrl);
        const hRatio = canvas.width / bg.width;
        const vRatio = canvas.height / bg.height;
        const ratio = Math.max(hRatio, vRatio);
        const centerShift_x = (canvas.width - bg.width * ratio) / 2;
        const centerShift_y = (canvas.height - bg.height * ratio) / 2;
        ctx.drawImage(bg, 0, 0, bg.width, bg.height, centerShift_x, centerShift_y, bg.width * ratio, bg.height * ratio);

        // Professional Dark Overlay with Gradient
        const overlay = ctx.createLinearGradient(0, 0, 0, height);
        overlay.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
        overlay.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, width, height);
    } catch (e) {
        ctx.fillStyle = '#0f111b';
        ctx.fillRect(0, 0, width, height);
    }

    // 2. Main Panel
    const panelX = 40;
    const panelY = 40;
    const panelW = width - 80;
    const panelH = height - 80;

    if (template === 'glass') {
        // Glassmorphism effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 35);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Panel Shine
        const shine = ctx.createLinearGradient(panelX, panelY, width, height);
        shine.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        shine.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
        shine.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
        ctx.fillStyle = shine;
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 35);
        ctx.fill();
    } else {
        ctx.fillStyle = 'rgba(12, 14, 28, 0.92)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 35);
        ctx.fill();
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    const isOnline = statusData?.online;
    const players = statusData?.players || { online: 0, max: 0 };
    const version = statusData?.version || 'N/A';
    const motd = statusData?.motd?.clean?.[0] || 'Minecraft Server';
    const cleanIpAddr = cleanIP(server.javaIP || server.bedrockIP);
    const iconUrl = `https://api.mcstatus.io/v2/icon/${cleanIpAddr}:${server.javaPort || server.bedrockPort || 25565}`;

    // 3. Server Icon (Bigger)
    const iconX = 80;
    const iconY = 85;
    const iconSize = 220;

    try {
        const icon = await loadImage(iconUrl);
        ctx.save();
        ctx.shadowBlur = 40;
        ctx.shadowColor = isOnline ? 'rgba(34, 224, 138, 0.6)' : 'rgba(255, 94, 94, 0.5)';
        ctx.beginPath();
        ctx.roundRect(iconX, iconY, iconSize, iconSize, 40);
        ctx.clip();
        ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
        ctx.restore();
    } catch (e) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(iconX, iconY, iconSize, iconSize, 40);
        ctx.fill();
    }

    // 4. Server Info (More Details)
    const infoX = iconX + iconSize + 60;
    const title = (server.serverName || 'Minecraft Server').toUpperCase();
    const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
    const statusColor = isOnline ? '#22E08A' : '#FF5E5E';

    // Server Name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 55px "Minecraft", Arial';
    ctx.textAlign = 'left';
    ctx.fillText(title, infoX, 145);

    // Status Dot + Text
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(infoX + 10, 195, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 28px Arial';
    ctx.fillText(statusText, infoX + 35, 205);

    // Players Info
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '32px Arial';
    ctx.fillText(`Players: ${players.online} / ${players.max}`, infoX, 260);

    // Version & MOTD
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '22px Arial';
    const versionLabel = typeof version === 'string' ? version : (version.name || 'N/A');
    ctx.fillText(`Version: ${versionLabel}`, infoX, 305);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'italic 18px Arial';
    ctx.fillText(`IP: ${cleanIpAddr}`, infoX, 340);

    // 5. Large Progress Bar
    if (isOnline && players.max > 0) {
        const barX = infoX;
        const barY = 275;
        const barW = 450;
        const barH = 12;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 6);
        ctx.fill();

        const progress = Math.min(players.online / players.max, 1);
        const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        grad.addColorStop(0, '#22E08A');
        grad.addColorStop(1, '#0bbf6b');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW * progress, barH, 6);
        ctx.fill();
    }

    // Footer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`PROMCBOT API • LIVE UPDATE • ${new Date().toLocaleTimeString()}`, width - 70, height - 65);

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
