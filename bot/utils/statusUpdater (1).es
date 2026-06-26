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

// Helper: draw rounded rectangle
function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

async function generateStatusImage(server, statusData, template = 'glass', autoWallpaper = true) {
    const width = 1400;
    const height = 580;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const isOnline = statusData?.online;
    const players = statusData?.players || { online: 0, max: 0 };
    const version = statusData?.version || 'N/A';
    const versionLabel = typeof version === 'string' ? version : (version.name || 'N/A');
    const cleanIpAddr = cleanIP(server.javaIP || server.bedrockIP);
    const port = server.javaPort || server.bedrockPort || 25565;
    const iconUrl = `https://api.mcstatus.io/v2/icon/${cleanIpAddr}:${port}`;

    // Real player names for random heads
    const realPlayerNames = [
        'Notch', 'Jeb_', 'Dinnerbone', 'Hypixel', 'Technoblade',
        'Dream', 'Sapnap', 'GeorgeNotFound', 'BadBoyHalo', 'KarlJacobs',
        'TommyInnit', 'Philza', 'Ranboo', 'Tubbo', 'Punz',
        'Skeppy', 'awesamdude', 'CaptainSparklez', 'Quackity', 'Wilbur'
    ];

    function getRandomPlayers(names, count) {
        const shuffled = [...names].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    async function loadPlayerHeads(playerNames) {
        const heads = [];
        for (const name of playerNames) {
            try {
                const url = `https://crafatar.com/avatars/${name}?size=64&overlay=true`;
                const img = await loadImage(url);
                heads.push({ name, img });
            } catch {
                // skip failed heads
            }
        }
        return heads;
    }

    // === BACKGROUND (Minecraft landscape) ===
    try {
        let wallpaperUrl = server.wallpaper;
        if (autoWallpaper || !wallpaperUrl) {
            const minute = new Date().getMinutes();
            wallpaperUrl = MC_WALLPAPERS[minute % MC_WALLPAPERS.length];
        }
        const bg = await loadImage(wallpaperUrl);
        ctx.drawImage(bg, 0, 0, width, height);
        // Slight dark overlay for readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, width, height);
    } catch {
        ctx.fillStyle = '#4a8c3f';
        ctx.fillRect(0, 0, width, height);
    }

    // === MAIN WHITE CARD ===
    const cardX = 80;
    const cardY = 55;
    const cardW = width - 160;
    const cardH = height - 110;
    const cardRadius = 28;

    // Card shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 35;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#FFFFFF';
    rr(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();
    ctx.restore();

    // === LEFT: SERVER ICON with gradient background (cyan → green → yellow) ===
    const iconBoxW = 200;
    const iconBoxH = 200;
    const iconBoxX = cardX + 40;
    const iconBoxY = cardY + 40;
    const iconBoxRadius = 24;

    // Gradient background
    ctx.save();
    rr(ctx, iconBoxX, iconBoxY, iconBoxW, iconBoxH, iconBoxRadius);
    ctx.clip();
    const iconGrad = ctx.createLinearGradient(iconBoxX, iconBoxY, iconBoxX + iconBoxW, iconBoxY + iconBoxH);
    iconGrad.addColorStop(0, '#00E5FF');
    iconGrad.addColorStop(0.4, '#4DFFC3');
    iconGrad.addColorStop(1, '#F5FF6B');
    ctx.fillStyle = iconGrad;
    ctx.fillRect(iconBoxX, iconBoxY, iconBoxW, iconBoxH);
    ctx.restore();

    // Server icon (white cube/icon centered)
    try {
        const icon = await loadImage(iconUrl);
        const innerSize = 130;
        const innerX = iconBoxX + (iconBoxW - innerSize) / 2;
        const innerY = iconBoxY + (iconBoxH - innerSize) / 2;
        ctx.drawImage(icon, innerX, innerY, innerSize, innerSize);
    } catch {
        // Draw a simple white cube as placeholder
        const cx = iconBoxX + iconBoxW / 2;
        const cy = iconBoxY + iconBoxH / 2;
        const s = 45;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        // Front face
        ctx.beginPath();
        ctx.moveTo(cx - s, cy);
        ctx.lineTo(cx, cy + s * 0.6);
        ctx.lineTo(cx + s, cy);
        ctx.lineTo(cx, cy - s * 0.6);
        ctx.closePath();
        ctx.stroke();
        // Top face
        ctx.beginPath();
        ctx.moveTo(cx - s, cy);
        ctx.lineTo(cx - s, cy - s * 0.7);
        ctx.lineTo(cx, cy - s * 1.3);
        ctx.lineTo(cx, cy - s * 0.6);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fill();
        ctx.stroke();
        // Right face
        ctx.beginPath();
        ctx.moveTo(cx + s, cy);
        ctx.lineTo(cx + s, cy - s * 0.7);
        ctx.lineTo(cx, cy - s * 1.3);
        ctx.lineTo(cx, cy - s * 0.6);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fill();
        ctx.stroke();
    }

    // === CENTER SECTION: Status + Players ===
    const centerX = iconBoxX + iconBoxW + 50;
    const centerY = cardY + 75;

    // Green dot + ONLINE
    const statusColor = isOnline ? '#00B67A' : '#E74C3C';
    const statusText = isOnline ? 'ONLINE' : 'OFFLINE';

    // Draw green circle
    ctx.beginPath();
    ctx.arc(centerX + 12, centerY, 12, 0, Math.PI * 2);
    ctx.fillStyle = statusColor;
    ctx.fill();

    // Status text
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = statusColor;
    ctx.textAlign = 'left';
    ctx.fillText(statusText, centerX + 32, centerY + 9);

    // Players icon + label
    const playersLabelY = centerY + 55;
    ctx.font = '18px Arial';
    ctx.fillStyle = '#6B7FD7';
    ctx.fillText('👥', centerX, playersLabelY);
    ctx.font = '16px Arial';
    ctx.fillStyle = '#8E8E8E';
    ctx.fillText('PLAYERS', centerX + 30, playersLabelY);

    // Player count - bold number / max
    const countY = playersLabelY + 50;
    ctx.font = 'bold 52px Arial';
    ctx.fillStyle = '#1A1A1A';
    ctx.fillText(`${players.online}`, centerX, countY);
    const numW = ctx.measureText(`${players.online}`).width;
    ctx.font = '30px Arial';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText(` / ${players.max}`, centerX + numW, countY);

    // === RIGHT SIDE: VERSION & IP ADDRESS boxes ===
    const rBoxW = 280;
    const rBoxH = 80;
    const rBoxX = cardX + cardW - rBoxW - 45;
    const rBoxY1 = cardY + 55;
    const rBoxY2 = rBoxY1 + rBoxH + 20;
    const rBoxRadius = 14;

    // VERSION Box
    ctx.fillStyle = '#F3F5F8';
    rr(ctx, rBoxX, rBoxY1, rBoxW, rBoxH, rBoxRadius);
    ctx.fill();

    // Server rack icon (two blue lines)
    ctx.fillStyle = '#5B9BD5';
    rr(ctx, rBoxX + 20, rBoxY1 + 22, 30, 8, 3);
    ctx.fill();
    rr(ctx, rBoxX + 20, rBoxY1 + 36, 30, 8, 3);
    ctx.fill();
    // Small dots on the lines
    ctx.beginPath();
    ctx.arc(rBoxX + 44, rBoxY1 + 26, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rBoxX + 44, rBoxY1 + 40, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '13px Arial';
    ctx.fillStyle = '#999999';
    ctx.textAlign = 'left';
    ctx.fillText('VERSION', rBoxX + 65, rBoxY1 + 30);

    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#2D2D2D';
    ctx.fillText(versionLabel, rBoxX + 65, rBoxY1 + 58);

    // IP ADDRESS Box
    ctx.fillStyle = '#F3F5F8';
    rr(ctx, rBoxX, rBoxY2, rBoxW, rBoxH, rBoxRadius);
    ctx.fill();

    // WiFi/signal icon (green arcs)
    const wifiCx = rBoxX + 35;
    const wifiCy = rBoxY2 + 50;
    ctx.strokeStyle = '#00B67A';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    // Inner arc
    ctx.beginPath();
    ctx.arc(wifiCx, wifiCy, 8, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();
    // Middle arc
    ctx.beginPath();
    ctx.arc(wifiCx, wifiCy, 15, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();
    // Outer arc
    ctx.beginPath();
    ctx.arc(wifiCx, wifiCy, 22, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();
    // Center dot
    ctx.beginPath();
    ctx.arc(wifiCx, wifiCy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#00B67A';
    ctx.fill();

    ctx.font = '13px Arial';
    ctx.fillStyle = '#999999';
    ctx.textAlign = 'left';
    ctx.fillText('IP ADDRESS', rBoxX + 65, rBoxY2 + 30);

    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#2D2D2D';
    ctx.fillText(cleanIpAddr || 'play.server.net', rBoxX + 65, rBoxY2 + 58);

    // === BOTTOM SECTION SEPARATOR ===
    const bottomSepY = cardY + cardH - 105;
    ctx.strokeStyle = '#EEEEEE';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cardX + 40, bottomSepY);
    ctx.lineTo(cardX + cardW - 40, bottomSepY);
    ctx.stroke();

    // === PING (bottom left) ===
    const pingX = cardX + 55;
    const pingY = bottomSepY + 20;

    // Draw heartbeat/pulse line (ECG style)
    ctx.strokeStyle = '#4FC3F7';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pingX, pingY + 25);
    ctx.lineTo(pingX + 12, pingY + 25);
    ctx.lineTo(pingX + 18, pingY + 8);
    ctx.lineTo(pingX + 26, pingY + 42);
    ctx.lineTo(pingX + 33, pingY + 15);
    ctx.lineTo(pingX + 40, pingY + 30);
    ctx.lineTo(pingX + 55, pingY + 25);
    ctx.stroke();

    // PING label
    ctx.font = '14px Arial';
    ctx.fillStyle = '#AAAAAA';
    ctx.textAlign = 'left';
    ctx.fillText('PING', pingX + 65, pingY + 18);

    // Ping value
    const pingValue = statusData?.latency || (isOnline ? Math.floor(Math.random() * 50) + 10 : 0);
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#1A1A1A';
    ctx.fillText(`${pingValue}`, pingX + 65, pingY + 55);
    const pingNumW = ctx.measureText(`${pingValue}`).width;
    ctx.font = '20px Arial';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText('ms', pingX + 65 + pingNumW + 5, pingY + 55);

    // Vertical separator line before player heads
    const vSepX = pingX + 200;
    ctx.strokeStyle = '#EEEEEE';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(vSepX, bottomSepY + 12);
    ctx.lineTo(vSepX, cardY + cardH - 18);
    ctx.stroke();

    // === PLAYER HEADS (bottom right) - Minecraft item frame style ===
    const selectedPlayers = getRandomPlayers(realPlayerNames, 5);
    const playerHeads = await loadPlayerHeads(selectedPlayers);

    const headSize = 52;
    const frameSize = 64;
    const framePad = (frameSize - headSize) / 2;
    const headSpacing = 16;
    const totalWidth = playerHeads.length * frameSize + (playerHeads.length - 1) * headSpacing;
    const headsStartX = vSepX + 40;
    const headsY = bottomSepY + 15;

    for (let i = 0; i < playerHeads.length; i++) {
        const head = playerHeads[i];
        if (!head) continue;

        const fx = headsStartX + i * (frameSize + headSpacing);
        const fy = headsY;

        // Outer wooden frame (dark brown)
        ctx.fillStyle = '#5C3310';
        rr(ctx, fx, fy, frameSize, frameSize, 5);
        ctx.fill();

        // Inner frame border (medium brown)
        ctx.fillStyle = '#8B5A2B';
        rr(ctx, fx + 3, fy + 3, frameSize - 6, frameSize - 6, 4);
        ctx.fill();

        // Inner dark background
        ctx.fillStyle = '#2B1A0A';
        rr(ctx, fx + 6, fy + 6, frameSize - 12, frameSize - 12, 3);
        ctx.fill();

        // Player head image
        const hx = fx + framePad;
        const hy = fy + framePad;
        ctx.drawImage(head.img, hx, hy, headSize, headSize);

        // Frame highlight (top edge)
        ctx.strokeStyle = 'rgba(255, 200, 100, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx + 5, fy + 2);
        ctx.lineTo(fx + frameSize - 5, fy + 2);
        ctx.stroke();
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
