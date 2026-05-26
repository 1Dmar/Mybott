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

    // 1. Background
    try {
        const bg = await loadImage(server.wallpaper || "https://i.ibb.co/TBVZycXV/2.png");
        ctx.drawImage(bg, 0, 0, width, height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, width, height);
    } catch (e) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
    }

    // 2. Glass Panel
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.roundRect(20, 20, width - 40, height - 40, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const isOnline = statusData?.online;
    const players = statusData?.players || { online: 0, max: 0 };
    const version = statusData?.version || 'N/A';
    const iconUrl = `https://api.mcstatus.io/v2/icon/${cleanIP(server.javaIP || server.bedrockIP)}:${server.javaPort || server.bedrockPort || 25565}`;

    // 3. Icon
    try {
        const icon = await loadImage(iconUrl);
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = isOnline ? 'rgba(0, 255, 127, 0.5)' : 'rgba(255, 69, 58, 0.5)';
        ctx.beginPath();
        ctx.roundRect(50, 50, 120, 120, 25);
        ctx.clip();
        ctx.drawImage(icon, 50, 50, 120, 120);
        ctx.restore();
    } catch (e) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(50, 50, 120, 120, 25);
        ctx.fill();
    }

    // 4. Text Info
    const infoX = 200;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowBlur = 5;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    
    // Server Name
    ctx.font = 'bold 32px Arial';
    ctx.fillText((server.serverName || 'Minecraft Server').toUpperCase(), infoX, 85);
    
    // Status Dot & Text
    ctx.shadowBlur = 0;
    const dotX = infoX + 5;
    const dotY = 115;
    ctx.fillStyle = isOnline ? '#00FF7F' : '#FF453A';
    ctx.beginPath();
    ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.font = 'bold 16px Arial';
    ctx.fillText(isOnline ? 'ONLINE' : 'OFFLINE', dotX + 20, dotY + 6);

    // Players & Version
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px Arial';
    ctx.fillText(`Players: ${players.online} / ${players.max}`, infoX, 155);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '16px Arial';
    ctx.fillText(`Version: ${typeof version === 'string' ? version : (version.name || 'N/A')}`, infoX, 185);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '14px Arial';
    ctx.fillText(`IP: ${server.javaIP || server.bedrockIP}`, infoX, 210);

    // 5. Progress Bar
    if (isOnline && players.max > 0) {
        const barX = infoX, barY = 165, barW = 300, barH = 6;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 3);
        ctx.fill();
        
        const progress = Math.min(players.online / players.max, 1);
        const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        grad.addColorStop(0, '#00FF7F');
        grad.addColorStop(1, '#00b359');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW * progress, barH, 3);
        ctx.fill();
    }

    // Footer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`PROMCBOT API • ${new Date().getFullYear()}`, width - 40, height - 35);

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
