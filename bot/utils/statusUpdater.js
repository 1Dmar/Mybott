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
    // Large Card Design (Enhanced)
    const width = 800;
    const height = 250;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Dynamic Background (Rotation every minute)
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
        overlay.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
        overlay.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, width, height);
    } catch (e) {
        ctx.fillStyle = '#0f111b';
        ctx.fillRect(0, 0, width, height);
    }

    // 2. Main Panel
    const panelX = 50;
    const panelY = 50;
    const panelW = width - 100;
    const panelH = height - 100;

    if (template === 'glass') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 40);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 3;
        ctx.stroke();
    } else {
        ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 40);
        ctx.fill();
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    const isOnline = statusData?.online;
    const players = statusData?.players || { online: 0, max: 0 };
    const version = statusData?.version || 'N/A';
    const cleanIpAddr = cleanIP(server.javaIP || server.bedrockIP);
    const iconUrl = `https://api.mcstatus.io/v2/icon/${cleanIpAddr}:${server.javaPort || server.bedrockPort || 25565}`;

    // 3. Server Icon (Large)
    const iconX = 50;
    const iconY = 50;
    const iconSize = 150;

    try {
        const icon = await loadImage(iconUrl);
        ctx.save();
        ctx.shadowBlur = 50;
        ctx.shadowColor = isOnline ? 'rgba(34, 224, 138, 0.7)' : 'rgba(255, 94, 94, 0.6)';
        ctx.beginPath();
        ctx.roundRect(iconX, iconY, iconSize, iconSize, 50);
        ctx.clip();
        ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
        ctx.restore();
    } catch (e) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(iconX, iconY, iconSize, iconSize, 50);
        ctx.fill();
    }

    // 4. Server Information
    const infoX = iconX + iconSize + 40;
    const title = (server.serverName || 'Minecraft Server').toUpperCase();
    const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
    const statusColor = isOnline ? '#22E08A' : '#FF5E5E';

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px "Minecraft", Arial';
    ctx.textAlign = 'left';
    ctx.fillText(title, infoX, 90);

    // Status (Removed Dot and Online Text)

    // Players
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '22px Arial';
    ctx.fillText(`Players: ${players.online} / ${players.max}`, infoX, 130);

    // Usage Text instead of Bar
    if (isOnline && players.max > 0) {
        const progress = Math.min(players.online / players.max, 1);
        const percentage = Math.round(progress * 100);
        ctx.fillStyle = '#22E08A';
        ctx.font = '18px Arial';
        ctx.fillText(`Usage: ${percentage}%`, infoX, 210);
    }

    // Additional Info
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '18px Arial';
    const versionLabel = typeof version === 'string' ? version : (version.name || 'N/A');
    ctx.fillText(`Version: ${versionLabel}`, infoX, 160);
    ctx.fillText(`IP: ${cleanIpAddr}`, infoX, 185);

    // Footer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '20px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`PROMCBOT LIVE • UPDATED: ${new Date().toLocaleTimeString()}`, width - 100, height - 80);

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
