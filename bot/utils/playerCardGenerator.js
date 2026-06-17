const { createCanvas, loadImage, registerFont } = require('canvas');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Register fonts if they exist
const fontsDir = path.join(__dirname, '../src/fonts');
if (fs.existsSync(path.join(fontsDir, 'd.ttf'))) {
    // registerFont(path.join(fontsDir, 'd.ttf'), { family: 'Minecraft' });
}

/**
 * جلب بيانات اللاعب من API السيرفر (Lobby) أو Mojang كخيار بديل
 */
async function getPlayerData(ign, serverConfig = null) {
    try {
        // إذا كان السيرفر يحتوي على إعدادات الـ API (Token + Port)
        if (serverConfig && serverConfig.apiToken) {
            const serverIP = serverConfig.javaIP || serverConfig.bedrockIP;
            const apiPort = serverConfig.apiPort || 8080; // المنفذ الثاني (Second Port)
            const protocol = "http"; 
            
            try {
                // جلب معلومات اللاعب من Lobby السيرفر
                const response = await axios.get(`${protocol}://${serverIP}:${apiPort}/player/${ign}`, {
                    headers: { 'Authorization': serverConfig.apiToken },
                    timeout: 5000
                });

                if (response.data && response.data.success) {
                    const data = response.data;
                    return {
                        uuid: data.uuid || null,
                        ign: data.username || ign,
                        isOnline: data.isOnline,
                        balance: data.balance,
                        level: data.level,
                        isBanned: data.isBanned,
                        customApi: true,
                        skinUrl: data.uuid ? `https://visage.surgeplay.com/bust/512/${ign}` : null
                    };
                }
            } catch (apiError) {
                console.warn(`Custom API failed for ${ign}:`, apiError.message);
            }
        }

        // خيار بديل: جلب البيانات الأساسية من Mojang
        const uuidResponse = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${ign}`, { timeout: 5000 });
        const uuid = uuidResponse.data.id;

        return {
            uuid,
            ign: uuidResponse.data.name,
            customApi: false,
            skinUrl: `https://visage.surgeplay.com/bust/512/${uuid}`
        };
    } catch (error) {
        console.error('Error fetching player data:', error.message);
        return null;
    }
}

/**
 * تحميل صورة سكن اللاعب (Bust)
 */
async function loadSkinImage(url) {
    if (!url) return null;
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
        return await loadImage(Buffer.from(response.data));
    } catch (e) {
        return null;
    }
}

/**
 * توليد بطاقة اللاعب بتصميم فخم
 */
async function generatePlayerCard(ign, template = 'glass', serverConfig = null) {
    const width = 1000;
    const height = 550;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const playerData = await getPlayerData(ign, serverConfig);
    if (!playerData) {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('اللاعب غير موجود', width / 2, height / 2);
        return canvas.toBuffer();
    }

    // 1. الخلفية (Background)
    try {
        const bgUrl = serverConfig?.wallpaper || "https://i.ibb.co/TBVZycXV/2.png";
        const background = await loadImage(bgUrl);
        ctx.drawImage(background, 0, 0, width, height);
        
        // طبقة تعتيم فخمة (Dark Overlay)
        const overlay = ctx.createLinearGradient(0, 0, width, 0);
        overlay.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
        overlay.addColorStop(0.5, 'rgba(0, 0, 0, 0.6)');
        overlay.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, width, height);
    } catch (e) {
        ctx.fillStyle = '#0f0f1b';
        ctx.fillRect(0, 0, width, height);
    }

    // 2. لوحة البيانات (Main Panel - Glassmorphism)
    const panelX = 40, panelY = 40, panelW = width - 80, panelH = height - 80;
    
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 30;
    
    const panelGrad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
    panelGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    panelGrad.addColorStop(1, 'rgba(255, 255, 255, 0.03)');
    
    ctx.fillStyle = panelGrad;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 35);
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 3. سكن اللاعب (Player Skin Render)
    const skinImg = await loadSkinImage(playerData.skinUrl);
    if (skinImg) {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 40;
        ctx.drawImage(skinImg, 50, 60, 420, 420);
        ctx.restore();
    }

    // 4. معلومات اللاعب (Player Information)
    const infoX = 500;
    
    // الاسم (IGN) مع توهج ذهبي
    ctx.save();
    ctx.shadowColor = 'rgba(212, 175, 55, 0.6)';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 75px Arial';
    ctx.fillText(playerData.ign, infoX, 140);
    ctx.restore();

    // حالة الاتصال (Status Badge)
    const statusText = playerData.customApi ? (playerData.isOnline ? "ONLINE" : "OFFLINE") : "VERIFIED";
    const statusColor = (playerData.customApi && !playerData.isOnline) ? "#FF4B2B" : "#00F260";
    
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.roundRect(infoX, 165, 140, 38, 12);
    ctx.fill();
    
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(statusText, infoX + 70, 193);
    ctx.textAlign = 'left';

    // 5. شبكة الإحصائيات (Stats Grid)
    const statsY = 250;
    const stats = [
        { label: "Level", value: playerData.level !== undefined ? `[${playerData.level}★]` : "N/A", icon: "⭐", color: "#00E5FF" },
        { label: "Balance", value: playerData.balance !== undefined ? `$${playerData.balance.toLocaleString()}` : "N/A", icon: "💰", color: "#FFC107" },
        { label: "Server", value: serverConfig?.serverName || "Lobby", icon: "🌐", color: "#A18CD1" }
    ];

    stats.forEach((stat, i) => {
        const y = statsY + (i * 85);
        
        // صندوق الإحصائية
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.beginPath();
        ctx.roundRect(infoX, y, 420, 70, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.stroke();

        // الأيقونة والعنوان
        ctx.font = '24px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(`${stat.icon} ${stat.label}`, infoX + 25, y + 43);

        // القيمة
        ctx.font = 'bold 30px Arial';
        ctx.fillStyle = stat.color;
        ctx.textAlign = 'right';
        ctx.fillText(stat.value, infoX + 400, y + 45);
        ctx.textAlign = 'left';
    });

    // 6. التذييل (Footer)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${serverConfig?.javaIP || 'play.server.com'} • PROMCBOT SYSTEM`, width / 2, height - 65);

    return canvas.toBuffer();
}

module.exports = { getPlayerData, generatePlayerCard };
