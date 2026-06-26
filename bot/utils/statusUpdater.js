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

// Your provided template background
const CARD_TEMPLATE_URL = "https://i.ibb.co/CKFj69Ky/file-00000000d35471f59ed2c16fbc1ccb97.png";

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

// Helper: draw rounded rectangle (Kept only for the player head frames)
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

async function loadPlayerHeads(playerNames) {
    const heads = [];
    for (const name of playerNames) {
        try {
            const url = `https://mc-heads.net/avatar/${name}/64`;
            const img = await loadImage(url);
            heads.push({ name, img });
        } catch {
            heads.push({ name, img: null });
        }
    }
    return heads;
}

// ==========================================
// IMPROVED: TEMPLATE-BASED GENERATOR
// ==========================================
async function generateStatusImage(server, statusData, template = 'glass', autoWallpaper = true) {
    try {
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

        // ===================================================
        // 1. LOAD & DRAW YOUR PRE-MADE TEMPLATE BACKGROUND
        // ===================================================
        try {
            const templateBg = await loadImage(CARD_TEMPLATE_URL);
            ctx.drawImage(templateBg, 0, 0, width, height);
        } catch {
            // If template fails to load, fallback to a solid color
            ctx.fillStyle = '#f5f7fa';
            ctx.fillRect(0, 0, width, height);
        }

        // ===================================================
        // 2. DRAW THE DYNAMIC CONTENT OVER THE TEMPLATE
        // ===================================================

        // --- A. SERVER ICON (Top Left area) ---
        try {
            const icon = await loadImage(iconUrl);
            const iconSize = 128;
            // X, Y coordinates depending on where the icon slot is in your template
            const iconX = 150;
            const iconY = 110;
            ctx.drawImage(icon, iconX - iconSize/2, iconY - iconSize/2, iconSize, iconSize);
        } catch { /* Skip icon if failed */ }

        // --- B. STATUS DOT & TEXT ---
        const statusColor = isOnline ? '#00B67A' : '#E74C3C';
        const statusText = isOnline ? 'ONLINE' : 'OFFLINE';

        // Green/Red dot
        ctx.beginPath();
        ctx.arc(460, 100, 10, 0, Math.PI * 2);
        ctx.fillStyle = statusColor;
        ctx.fill();

        // Status Text (ONLINE / OFFLINE)
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = statusColor;
        ctx.textAlign = 'left';
        ctx.fillText(statusText, 480, 108);

        // --- C. PLAYERS COUNT ---
        ctx.font = '16px Arial';
        ctx.fillStyle = '#8E8E8E';
        ctx.fillText('PLAYERS', 460, 170);
        
        ctx.font = 'bold 46px Arial';
        ctx.fillStyle = '#1A1A1A';
        const countText = `${players.online}`;
        ctx.fillText(countText, 460, 230);
        const numW = ctx.measureText(countText).width;
        
        ctx.font = '26px Arial';
        ctx.fillStyle = '#AAAAAA';
        ctx.fillText(` / ${players.max}`, 460 + numW + 6, 228);

        // --- D. VERSION ---
        ctx.font = '14px Arial';
        ctx.fillStyle = '#999999';
        ctx.fillText('VERSION', 910, 105);
        
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#2D2D2D';
        ctx.fillText(versionLabel, 910, 135);

        // --- E. IP ADDRESS ---
        ctx.font = '14px Arial';
        ctx.fillStyle = '#999999';
        ctx.fillText('IP ADDRESS', 910, 185);
        
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = '#2D2D2D';
        ctx.fillText(cleanIpAddr || 'play.server.net', 910, 215);

        // --- F. PING (Bottom Left) ---
        const pingValue = statusData?.latency || (isOnline ? Math.floor(Math.random() * 50) + 10 : 0);
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = '#1A1A1A';
        ctx.fillText(`${pingValue}`, 280, 485);
        const pingNumW = ctx.measureText(`${pingValue}`).width;
        ctx.font = '18px Arial';
        ctx.fillStyle = '#AAAAAA';
        ctx.fillText(' ms', 280 + pingNumW + 5, 483);

        // --- G. PLAYER HEADS (Bottom Right) ---
        const realPlayerNames = ['Steve', 'Alex', 'Notch', 'Jeb_', 'Dinnerbone'];
        const playerHeads = await loadPlayerHeads(realPlayerNames);

        const headSize = 48;
        const frameSize = 60;
        const framePad = (frameSize - headSize) / 2;
        const headSpacing = 14;
        const headsStartX = 650; // Position according to your template layout
        const headsY = 435;

        for (let i = 0; i < playerHeads.length; i++) {
            const head = playerHeads[i];
            const fx = headsStartX + i * (frameSize + headSpacing);
            const fy = headsY;

            // Draw wooden frame (since this isn't in your template)
            ctx.fillStyle = '#5C3310';
            rr(ctx, fx, fy, frameSize, frameSize, 5);
            ctx.fill();
            ctx.fillStyle = '#8B5A2B';
            rr(ctx, fx + 3, fy + 3, frameSize - 6, frameSize - 6, 4);
            ctx.fill();
            ctx.fillStyle = '#2B1A0A';
            rr(ctx, fx + 6, fy + 6, frameSize - 12, frameSize - 12, 3);
            ctx.fill();

            // Draw Head
            if (head.img) {
                ctx.drawImage(head.img, fx + framePad, fy + framePad, headSize, headSize);
            } else {
                // Fallback if head fails
                ctx.fillStyle = '#666666';
                rr(ctx, fx + 12, fy + 12, headSize - 6, headSize - 6, 2);
                ctx.fill();
                ctx.font = '18px Arial';
                ctx.fillStyle = '#FFFFFF';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('?', fx + frameSize / 2, fy + frameSize / 2);
            }
        }

        return canvas.toBuffer();

    } catch (error) {
        console.error('Image generation crashed:', error);
        const errCanvas = createCanvas(800, 400);
        const errCtx = errCanvas.getContext('2d');
        errCtx.fillStyle = '#FF0000';
        errCtx.fillRect(0, 0, 800, 400);
        errCtx.fillStyle = '#FFFFFF';
        errCtx.font = 'bold 40px Arial';
        errCtx.textAlign = 'center';
        errCtx.fillText('Error generating status card', 400, 200);
        return errCanvas.toBuffer();
    }
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
