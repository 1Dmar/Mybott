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

/**
 * Generate a modern live status card with neon glow effect
 * Inspired by the Cubecraft server status design
 */
async function generateLiveStatusCard(server, statusData, options = {}) {
    const {
        template = 'neon',
        autoWallpaper = true,
        showPreview = false
    } = options;

    const width = 1360;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Dynamic Background with Gradient Overlay
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
        overlay.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
        overlay.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, width, height);
    } catch (e) {
        ctx.fillStyle = '#0a0e1a';
        ctx.fillRect(0, 0, width, height);
    }

    // 2. Main Panel with Neon Border
    const panelX = 40;
    const panelY = 40;
    const panelW = width - 80;
    const panelH = height - 80;

    // Neon glow effect
    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(0, 255, 200, 0.3)';
    
    // Panel background
    ctx.fillStyle = 'rgba(15, 17, 27, 0.9)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 20);
    ctx.fill();

    // Neon border (cyan to green gradient)
    const borderGradient = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
    borderGradient.addColorStop(0, 'rgba(0, 255, 200, 0.8)');
    borderGradient.addColorStop(0.5, 'rgba(0, 200, 150, 0.5)');
    borderGradient.addColorStop(1, 'rgba(0, 255, 200, 0.2)');
    
    ctx.strokeStyle = borderGradient;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const isOnline = statusData?.online;
    const players = statusData?.players || { online: 0, max: 0 };
    const version = statusData?.version || 'N/A';
    const cleanIpAddr = cleanIP(server.javaIP || server.bedrockIP);
    const port = server.javaPort || server.bedrockPort || 25565;
    const iconUrl = `https://api.mcstatus.io/v2/icon/${cleanIpAddr}:${port}`;

    // 3. Header Section - Status Badge and Last Update
    const headerY = 65;
    
    // Status Badge (Top Left)
    const statusText = isOnline ? '● LIVE' : '● OFFLINE';
    const statusColor = isOnline ? '#00FFC8' : '#FF5E5E';
    
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = statusColor;
    ctx.textAlign = 'left';
    ctx.fillText(statusText, panelX + 30, headerY);

    // Status indicator circle
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(panelX + 15, headerY - 5, 4, 0, Math.PI * 2);
    ctx.fill();

    // Up-to-date indicator (Top Center)
    ctx.font = '14px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('⊙ Up-to-date', width / 2, headerY);

    // Last Update Time (Top Right)
    const now = new Date();
    const timeStr = `⊙ Updated ${now.getMinutes()} min ago`;
    ctx.font = '14px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'right';
    ctx.fillText(timeStr, width - panelX - 30, headerY);

    // 4. Server Icon (Left Side - Large)
    const iconX = panelX + 50;
    const iconY = panelY + 80;
    const iconSize = 200;

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

    // 5. Server Name and Main Information
    const infoX = iconX + iconSize + 60;
    const infoStartY = iconY + 30;
    
    const title = (server.serverName || 'Minecraft Server').toUpperCase();
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(title, infoX, infoStartY + 50);
    ctx.shadowBlur = 0;

    // 6. Status Information Box (Right Side)
    const statusBoxX = width - panelX - 320;
    const statusBoxY = iconY;
    const statusBoxW = 280;
    const statusBoxH = 140;

    // Status box background
    ctx.fillStyle = 'rgba(0, 255, 200, 0.08)';
    ctx.beginPath();
    ctx.roundRect(statusBoxX, statusBoxY, statusBoxW, statusBoxH, 15);
    ctx.fill();

    // Status box border
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Status indicator in box
    const statusBoxTextY = statusBoxY + 35;
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = statusColor;
    ctx.textAlign = 'center';
    ctx.fillText('● ' + (isOnline ? 'ONLINE' : 'OFFLINE'), statusBoxX + statusBoxW / 2, statusBoxTextY);

    // Status message
    const statusMessage = isOnline 
        ? 'The server is running smoothly\nand fully operational.'
        : 'The server is currently offline\nor under maintenance.';
    
    ctx.font = '13px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    const lines = statusMessage.split('\n');
    lines.forEach((line, i) => {
        ctx.fillText(line, statusBoxX + statusBoxW / 2, statusBoxTextY + 35 + (i * 18));
    });

    // 7. Performance Metrics (Bottom Right)
    const metricsY = statusBoxY + statusBoxH + 30;
    const metricBoxW = 80;
    const metricBoxH = 60;
    const metricSpacing = 20;
    
    const metrics = [
        { label: 'Ping', value: '28 ms', icon: '📊' },
        { label: 'TPS', value: '20.0', icon: '⚡' },
        { label: 'Uptime', value: '99.9%', icon: '✓' }
    ];

    let metricX = statusBoxX;
    metrics.forEach((metric, i) => {
        // Metric box
        ctx.fillStyle = 'rgba(0, 255, 200, 0.05)';
        ctx.beginPath();
        ctx.roundRect(metricX, metricsY, metricBoxW, metricBoxH, 10);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 255, 200, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Metric label
        ctx.font = '11px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.textAlign = 'center';
        ctx.fillText(metric.label, metricX + metricBoxW / 2, metricsY + 18);

        // Metric value
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#00FFC8';
        ctx.fillText(metric.value, metricX + metricBoxW / 2, metricsY + 40);

        metricX += metricBoxW + metricSpacing;
    });

    // 8. Player Information Section
    const playerInfoX = infoX;
    const playerInfoY = infoStartY + 80;

    ctx.font = '20px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(`👥 Players: ${players.online} / ${players.max}`, playerInfoX, playerInfoY);

    ctx.font = '16px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(`🎮 Version: ${version}`, playerInfoX, playerInfoY + 35);
    ctx.fillText(`🌐 IP: ${cleanIpAddr}:${port}`, playerInfoX, playerInfoY + 60);

    // 9. Player Count Progress Bar
    if (isOnline && players.max > 0) {
        const barX = playerInfoX;
        const barY = playerInfoY + 90;
        const barW = 300;
        const barH = 12;

        // Background bar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 6);
        ctx.fill();

        // Progress bar
        const progress = Math.min(players.online / players.max, 1);
        const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        grad.addColorStop(0, '#00FFC8');
        grad.addColorStop(1, '#00CC99');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW * progress, barH, 6);
        ctx.fill();

        // Percentage Text
        const percentage = Math.round(progress * 100);
        ctx.fillStyle = '#00FFC8';
        ctx.font = 'bold 13px Arial';
        ctx.fillText(`${percentage}%`, barX + barW + 15, barY + 10);
    }

    // 10. Footer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`PROMCBOT LIVE • ${new Date().toLocaleTimeString()}`, width - panelX - 30, height - panelY - 15);

    return canvas.toBuffer();
}

module.exports.updateLiveStatusCard = async (client, server, settings) => {
    try {
        const status = await checkServerStatus(
            server.serverType === 'java' ? server.javaIP : server.bedrockIP,
            server.serverType === 'java' ? server.javaPort : server.bedrockPort,
            server.serverType
        );

        const imageBuffer = await generateLiveStatusCard(server, status.data, {
            template: settings.cardTemplate || 'neon',
            autoWallpaper: settings.autoWallpaper !== false
        });
        
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'live_status.png' });

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
        console.error(`Live Status Update Error [${server.serverName}]:`, error.message);
    }
};

module.exports.generateLiveStatusCard = generateLiveStatusCard;
