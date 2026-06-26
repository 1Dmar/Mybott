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
    const width = 1100;
    const height = 420;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const isOnline = statusData?.online;
    const players = statusData?.players || { online: 0, max: 0 };
    const version = statusData?.version || 'N/A';
    const versionLabel = typeof version === 'string' ? version : (version.name || 'N/A');
    const cleanIpAddr = cleanIP(server.javaIP || server.bedrockIP);
    const port = server.javaPort || server.bedrockPort || 25565;
    const iconUrl = `https://api.mcstatus.io/v2/icon/${cleanIpAddr}:${port}`;

    // List of real player names for avatars
    const realPlayerNames = [
        'Notch', 'Jeb_', 'Dinnerbone', 'Hypixel', 'Technoblade', 'Dream', 'Sapnap',
        'GeorgeNotFound', 'BadBoyHalo', 'KarlJacobs', 'Herobrine', 'Steve', 'Alex',
        'Creeper', 'Zombie', 'Skeleton', 'Enderman', 'Ghast', 'Blaze', 'WitherSkeleton'
    ];

    // Function to get random players
    function getRandomPlayers(names, count) {
        const shuffled = [...names].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    // Load player heads
    async function loadPlayerHeads(playerNames) {
        const heads = await Promise.all(
            playerNames.map(async (name) => {
                const url = `https://crafatar.com/avatars/${name}?size=64&overlay=true`;
                try {
                    const img = await loadImage(url);
                    return { name, img };
                } catch (error) {
                    console.error(`Failed to load player head for ${name}:`, error.message);
                    return null; // Return null for failed images
                }
            })
        );
        return heads.filter(head => head !== null); // Filter out failed images
    }

    // Background
    try {
        let wallpaperUrl = server.wallpaper;
        if (autoWallpaper || !wallpaperUrl) {
            const minute = new Date().getMinutes();
            wallpaperUrl = MC_WALLPAPERS[minute % MC_WALLPAPERS.length];
        }
        const bg = await loadImage(wallpaperUrl);
        ctx.drawImage(bg, 0, 0, width, height);
    } catch {
        ctx.fillStyle = '#0B0E1A';
        ctx.fillRect(0, 0, width, height);
    }

    // Main Card
    const cardX = 50;
    const cardY = 50;
    const cardW = width - 100;
    const cardH = height - 100;
    const cornerRadius = 20;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cornerRadius);
    ctx.fill();
    ctx.restore();

    // Left Side: Server Icon with gradient background
    const iconBgSize = 120;
    const iconBgX = cardX + 30;
    const iconBgY = cardY + 30;
    const iconBgRadius = 18;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(iconBgX, iconBgY, iconBgSize, iconBgSize, iconBgRadius);
    ctx.clip();
    const gradient = ctx.createLinearGradient(iconBgX, iconBgY, iconBgX + iconBgSize, iconBgY + iconBgSize);
    gradient.addColorStop(0, '#00C6FF'); // Cyan
    gradient.addColorStop(1, '#FFD100'); // Yellow
    ctx.fillStyle = gradient;
    ctx.fillRect(iconBgX, iconBgY, iconBgSize, iconBgSize);
    ctx.restore();

    // Server Icon
    try {
        const icon = await loadImage(iconUrl);
        const iconSize = 90;
        const iconX = iconBgX + (iconBgSize - iconSize) / 2;
        const iconY = iconBgY + (iconBgSize - iconSize) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(iconX, iconY, iconSize, iconSize, 15); // Slightly smaller radius for inner icon
        ctx.clip();
        ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
        ctx.restore();
    } catch {
        // Placeholder if icon fails to load
        ctx.fillStyle = '#888888';
        ctx.fillRect(iconBgX + 20, iconBgY + 20, iconBgSize - 40, iconBgSize - 40);
    }

    // Center Section: Status and Players
    const centerTextX = cardX + iconBgX + iconBgSize - 10;
    const centerTextY = cardY + 55;

    // Status (Online/Offline)
    const statusColor = isOnline ? '#00B894' : '#D63031'; // Green for online, Red for offline
    const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = statusColor;
    ctx.textAlign = 'left';
    ctx.fillText('● ' + statusText, centerTextX, centerTextY);

    // Players
    const playersIcon = '👥'; // Unicode for players icon
    ctx.font = '18px Arial';
    ctx.fillStyle = '#555555';
    ctx.fillText(playersIcon + ' PLAYERS', centerTextX, centerTextY + 40);

    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText(`${players.online} / ${players.max}`, centerTextX, centerTextY + 75);

    // Right Side: Version and IP Address boxes
    const rightBoxWidth = 250;
    const rightBoxHeight = 60;
    const rightBoxRadius = 10;
    const rightBoxX = cardX + cardW - rightBoxWidth - 30;
    const rightBoxY1 = cardY + 30;
    const rightBoxY2 = rightBoxY1 + rightBoxHeight + 15;

    // Version Box
    ctx.fillStyle = '#F0F0F0';
    ctx.beginPath();
    ctx.roundRect(rightBoxX, rightBoxY1, rightBoxWidth, rightBoxHeight, rightBoxRadius);
    ctx.fill();

    ctx.font = '20px Arial';
    ctx.fillStyle = '#555555';
    ctx.fillText('🖥️ VERSION', rightBoxX + 20, rightBoxY1 + 25);
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText(versionLabel, rightBoxX + 20, rightBoxY1 + 48);

    // IP Address Box
    ctx.fillStyle = '#F0F0F0';
    ctx.beginPath();
    ctx.roundRect(rightBoxX, rightBoxY2, rightBoxWidth, rightBoxHeight, rightBoxRadius);
    ctx.fill();

    ctx.font = '20px Arial';
    ctx.fillStyle = '#555555';
    ctx.fillText('📡 IP ADDRESS', rightBoxX + 20, rightBoxY2 + 25);
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText(cleanIpAddr || 'N/A', rightBoxX + 20, rightBoxY2 + 48);

    // Bottom Bar inside the card
    const bottomBarY = cardY + cardH - 80;
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 30, bottomBarY);
    ctx.lineTo(cardX + cardW - 30, bottomBarY);
    ctx.stroke();

    // Ping
    const pingIcon = '📈'; // Heartbeat line icon
    ctx.font = '20px Arial';
    ctx.fillStyle = '#555555';
    ctx.fillText(pingIcon + ' PING', cardX + 30, bottomBarY + 35);
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText(`${statusData?.latency || 'N/A'} ms`, cardX + 30, bottomBarY + 60);

    // Player Heads
    const selectedPlayers = getRandomPlayers(realPlayerNames, 5);
    const playerHeads = await loadPlayerHeads(selectedPlayers);

    const headSize = 64;
    const headSpacing = 15;
    const totalHeadsWidth = (headSize + headSpacing) * playerHeads.length - headSpacing;
    const headsStartX = cardX + cardW - 30 - totalHeadsWidth;
    const headsY = bottomBarY + 15;

    for (let i = 0; i < playerHeads.length; i++) {
        const head = playerHeads[i];
        if (!head) continue; // Skip if head image failed to load

        const hx = headsStartX + i * (headSize + headSpacing);
        const hy = headsY;

        // Wooden/brown square frame
        ctx.fillStyle = '#8B4513'; // SaddleBrown
        ctx.fillRect(hx - 3, hy - 3, headSize + 6, headSize + 6); // Border
        ctx.fillStyle = '#A0522D'; // Sienna
        ctx.fillRect(hx - 1, hy - 1, headSize + 2, headSize + 2); // Inner border

        // Draw player head
        ctx.drawImage(head.img, hx, hy, headSize, headSize);
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
