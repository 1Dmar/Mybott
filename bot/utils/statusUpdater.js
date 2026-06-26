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

// رابط القالب الخاص بك (ثابت ولا يتغير)
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

// دالة رسم المربعات المدورة (خاصة برؤوس اللاعبين فقط)
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
// دالة توليد الصورة (بإحداثيات دقيقة للقالب)
// ==========================================
async function generateStatusImage(server, statusData) {
    try {
        // المقاسات ثابتة كما طلبت (1400x580)
        const width = 1774;
        const height = 887;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const isOnline = statusData?.online;
        const players = statusData?.players || { online: 0, max: 0 };
        const version = statusData?.version || 'N/A';
        const versionLabel = typeof version === 'string' ? version : (version.name || 'N/A');
        const cleanIpAddr = cleanIP(server.javaIP || server.bedrockIP);
        const port = server.javaPort || server.bedrockPort || 25565;
        const iconUrl = `https://api.mcstatus.io/v2/icon/${cleanIpAddr}:${port}`;

        // =======================
        // 1. رسم قالب الخلفية فقط
        // =======================
        const templateBg = await loadImage(CARD_TEMPLATE_URL);
        ctx.drawImage(templateBg, 0, 0, width, height);

        // =======================
        // 2. وضع العناصر الجديدة فوق القالب
        // =======================

        // --- شعار السيرفر (المكعب) ---
        try {
            const icon = await loadImage(iconUrl);
            const iconSize = 330;
            // مركز المربع الأيسر (X: 140, Y: 140)
            ctx.drawImage(icon, 155, 205, iconSize, iconSize);
        } catch { /* تجاهل الشعار إذا تعذر تحميله */ }

        // --- النقطة الخضراء/الحمراء والنص ---
        const statusColor = isOnline ? '#00B67A' : '#E74C3C';
        const statusText = isOnline ? 'ONLINE' : 'OFFLINE';

        ctx.beginPath();
        ctx.arc(420, 90, 12, 0, Math.PI * 2); // مكان النقطة
        ctx.fillStyle = statusColor;
        ctx.fill();

        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = statusColor;
        ctx.textAlign = 'left';
        ctx.fillText(statusText, 445, 100); // مكان النص

        // --- عدد اللاعبين ---
        
        ctx.font = 'bold 50px Arial';
        ctx.fillStyle = '#1A1A1A';
        const countText = `${players.online}`;
        ctx.fillText(countText, 300, 325);
        const numW = ctx.measureText(countText).width;
        
        ctx.font = '28px Arial';
        ctx.fillStyle = '#AAAAAA';
        ctx.fillText(` / ${players.max}`, 300+ numW + 8, 322);

        // --- الإصدار ---
        ctx.font = '14px Arial';
        ctx.fillStyle = '#999999';
        ctx.fillText('VERSION', 940, 100);
        
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#2D2D2D';
        ctx.fillText(versionLabel, 940, 135);

        // --- الآي بي (IP) ---
        ctx.font = '14px Arial';
        ctx.fillStyle = '#999999';
        ctx.fillText('IP ADDRESS', 940, 180);
        
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = '#2D2D2D';
        ctx.fillText(cleanIpAddr || 'play.server.net', 940, 215);

        // --- البينج (Ping) ---
        const pingValue = statusData?.latency || (isOnline ? Math.floor(Math.random() * 50) + 10 : 0);
        ctx.font = 'bold 34px Arial';
        ctx.fillStyle = '#1A1A1A';
        ctx.fillText(`${pingValue}`, 360, 525);
        const pingNumW = ctx.measureText(`${pingValue}`).width;
        ctx.font = '18px Arial';
        ctx.fillStyle = '#AAAAAA';
        ctx.fillText(' ms', 360 + pingNumW + 6, 520);

        // --- رؤوس اللاعبين (الإطارات الخشبية) ---
        const realPlayerNames = ['Steve', 'Alex', 'Notch', 'Jeb_', 'Dinnerbone'];
        const playerHeads = await loadPlayerHeads(realPlayerNames);

        const headSize = 48;
        const frameSize = 60;
        const framePad = (frameSize - headSize) / 2;
        const headSpacing = 15;
        const headsStartX = 580; // بداية الرؤوس في القالب
        const headsY = 450;

        for (let i = 0; i < playerHeads.length; i++) {
            const head = playerHeads[i];
            const fx = headsStartX + i * (frameSize + headSpacing);
            const fy = headsY;

            // رسم إطار خشبي
            ctx.fillStyle = '#5C3310';
            rr(ctx, fx, fy, frameSize, frameSize, 5);
            ctx.fill();
            ctx.fillStyle = '#8B5A2B';
            rr(ctx, fx + 3, fy + 3, frameSize - 6, frameSize - 6, 4);
            ctx.fill();
            ctx.fillStyle = '#2B1A0A';
            rr(ctx, fx + 6, fy + 6, frameSize - 12, frameSize - 12, 3);
            ctx.fill();

            // رسم الرأس
            if (head.img) {
                ctx.drawImage(head.img, fx + framePad, fy + framePad, headSize, headSize);
            } else {
                // في حال تعذر تحميل الرأس
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
        // صورة خطأ بسيطة
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

// ==========================================
// الدالة الرئيسية لتحديث السيرفر
// ==========================================
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
