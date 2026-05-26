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

async function generateStatusImage(server, statusData) {
    const width = 800;
    const height = 250;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background (Luxury Theme)
    try {
        const bg = await loadImage(server.wallpaper || "https://i.ibb.co/TBVZycXV/2.png");
        ctx.drawImage(bg, 0, 0, width, height);

        const overlay = ctx.createLinearGradient(0, 0, width, height);
        overlay.addColorStop(0, 'rgba(7, 10, 24, 0.82)');
        overlay.addColorStop(0.55, 'rgba(12, 14, 28, 0.7)');
        overlay.addColorStop(1, 'rgba(8, 10, 20, 0.92)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, width, height);

        const vignette = ctx.createRadialGradient(width * 0.25, height * 0.2, 30, width * 0.6, height * 0.6, width);
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);
    } catch (e) {
        const fallback = ctx.createLinearGradient(0, 0, width, height);
        fallback.addColorStop(0, '#0f111b');
        fallback.addColorStop(1, '#080a14');
        ctx.fillStyle = fallback;
        ctx.fillRect(0, 0, width, height);
    }

    // 2. Glass Panel + Accent
    const panelX = 24;
    const panelY = 24;
    const panelW = width - 48;
    const panelH = height - 48;

    ctx.fillStyle = 'rgba(16, 18, 32, 0.68)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 26);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    const accent = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
    accent.addColorStop(0, 'rgba(212, 175, 55, 0.9)');
    accent.addColorStop(0.45, 'rgba(212, 175, 55, 0.2)');
    accent.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.fillStyle = accent;
    ctx.fillRect(panelX + 18, panelY + 10, panelW - 36, 2);

    const isOnline = statusData?.online;
    const players = statusData?.players || { online: 0, max: 0 };
    const version = statusData?.version || 'N/A';
    const iconUrl = `https://api.mcstatus.io/v2/icon/${cleanIP(server.javaIP || server.bedrockIP)}:${server.javaPort || server.bedrockPort || 25565}`;

    // 3. Icon
    const iconX = 52;
    const iconY = 54;
    const iconSize = 116;
    try {
        const icon = await loadImage(iconUrl);
        ctx.save();
        ctx.shadowBlur = 24;
        ctx.shadowColor = isOnline ? 'rgba(34, 224, 138, 0.55)' : 'rgba(255, 94, 94, 0.5)';
        ctx.beginPath();
        ctx.roundRect(iconX, iconY, iconSize, iconSize, 26);
        ctx.clip();
        ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
        ctx.restore();
    } catch (e) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.roundRect(iconX, iconY, iconSize, iconSize, 26);
        ctx.fill();
    }

    const infoX = iconX + iconSize + 38;
    const title = (server.serverName || 'Minecraft Server').toUpperCase();
    const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
    const statusColor = isOnline ? '#22E08A' : '#FF5E5E';

    // Status Badge
    ctx.font = 'bold 14px Arial';
    const badgePadding = 12;
    const badgeWidth = ctx.measureText(statusText).width + badgePadding * 2;
    const badgeX = width - badgeWidth - 70;
    const badgeY = 58;
    ctx.fillStyle = 'rgba(10, 12, 22, 0.6)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, 26, 13);
    ctx.fill();
    ctx.strokeStyle = statusColor;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = statusColor;
    ctx.fillText(statusText, badgeX + badgePadding, badgeY + 18);

    // Server Name
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px "Minecraft", Arial';
    ctx.fillText(title, infoX, 88);
    ctx.shadowBlur = 0;

    // Status Dot
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(infoX + 4, 116, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 16px Arial';
    ctx.fillText(statusText, infoX + 18, 121);

    // Players & Version
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px Arial';
    ctx.fillText(`Players: ${players.online} / ${players.max}`, infoX, 155);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '16px Arial';
    const versionLabel = typeof version === 'string' ? version : (version.name || 'N/A');
    ctx.fillText(`Version: ${versionLabel}`, infoX, 184);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '14px Arial';
    ctx.fillText(`IP: ${server.javaIP || server.bedrockIP}`, infoX, 208);

    // 5. Progress Bar
    if (isOnline && players.max > 0) {
        const barX = infoX;
        const barY = 170;
        const barW = 320;
        const barH = 7;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 4);
        ctx.fill();

        const progress = Math.min(players.online / players.max, 1);
        const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        grad.addColorStop(0, '#22E08A');
        grad.addColorStop(1, '#0bbf6b');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW * progress, barH, 4);
        ctx.fill();
    }

    // Footer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`PROMCBOT API • ${new Date().getFullYear()}`, width - 40, height - 34);

    return canvas.toBuffer();
}

module.exports.updateServerStatus = async (client, server, settings) => {
    try {
        const status = await checkServerStatus(
            server.serverType === 'java' ? server.javaIP : server.bedrockIP,
            server.serverType === 'java' ? server.javaPort : server.bedrockPort,
            server.serverType
        );

        const imageBuffer = await generateStatusImage(server, status.data);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'status.png' });

        const channel = await client.channels.fetch(settings.statusChannelId);
        if (!channel) return;

        const content = ``; // Empty content, just the image

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
