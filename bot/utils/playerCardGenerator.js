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
 * تحميل صورة سكن اللاعب (Bust) مع تجربة أكثر من API لو الأول فشل
 * يجرب كل رابط بالترتيب لحد ما يلاقي صورة شغالة
 */
async function loadFirstAvailableImage(urls) {
    for (const url of urls) {
        if (!url) continue;
        try {
            const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
            const buffer = Buffer.from(response.data);
            if (buffer.length < 200) continue; // رد فاضي/خطأ بدل صورة حقيقية
            const img = await loadImage(buffer);
            if (img && img.width > 0) return img;
        } catch (e) {
            // فشل هذا الرابط، جرب اللي بعده
            continue;
        }
    }
    return null;
}

/**
 * يبني قائمة روابط بديلة (Bust APIs) لنفس اللاعب بالترتيب
 */
function buildSkinCandidates(playerData) {
    const id = playerData.uuid || playerData.ign; // اليوزر نيم بيشتغل مع كل الـ APIs دي برضو
    const candidates = [];
    if (playerData.skinUrl) candidates.push(playerData.skinUrl);
    candidates.push(`https://visage.surgeplay.com/bust/512/${id}`);
    candidates.push(`https://visage.surgeplay.com/bust/512/${playerData.ign}`);
    candidates.push(`https://minotar.net/armor/bust/${playerData.ign}/512.png`);
    candidates.push(`https://mc-heads.net/body/${playerData.ign}/512`);
    candidates.push(`https://visage.surgeplay.com/bust/512/MHF_Steve`); // fallback أخير مضمون يشتغل
    return candidates;
}

/**
 * يفحص إذا اللاعب عنده كيب رسمي (حساب Mojang أصلي/مميز)
 * بيستخدم Session Server الرسمي ويفك تشفير الـ textures عشان يلاقي رابط الكيب
 */
async function getMojangCape(uuid) {
    if (!uuid) return null;
    try {
        const res = await axios.get(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}?unsigned=false`, { timeout: 6000 });
        const props = res.data && res.data.properties;
        if (!props || !props.length) return null;
        const texturesProp = props.find(p => p.name === 'textures');
        if (!texturesProp) return null;
        const decoded = JSON.parse(Buffer.from(texturesProp.value, 'base64').toString('utf-8'));
        const capeUrl = decoded && decoded.textures && decoded.textures.CAPE && decoded.textures.CAPE.url;
        return capeUrl ? { label: 'Mojang Cape', url: capeUrl, cropFrontFace: true } : null;
    } catch (e) {
        return null; // حساب أوفلاين / فشل الاتصال = نتجاهل بهدوء
    }
}

/**
 * يفحص إذا اللاعب عنده كيب OptiFine (نظام منفصل تماماً عن Mojang)
 */
async function getOptifineCape(username) {
    if (!username) return null;
    try {
        const url = `http://s.optifine.net/capes/${username}.png`;
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 6000 });
        const buffer = Buffer.from(res.data);
        if (buffer.length < 200) return null; // رد فاضي = مفيش كيب أوبتيفاين
        const img = await loadImage(buffer);
        // OptiFine ما بيستخدم نفس شكل ملف Mojang، فمش بنقص نفس الإحداثيات (cropFrontFace: false)
        return { label: 'OptiFine Cape', img, cropFrontFace: false };
    } catch (e) {
        return null;
    }
}

/**
 * يجمع كل الكيبات المتاحة للاعب (Mojang + OptiFine)، ولو مفيش ولا واحد
 * بيرجع كيب مخصص (Custom) بديل عشان الخانة ما تفضل فاضية
 */
async function buildCapeBadges(playerData) {
    const [mojangCape, optifineCape] = await Promise.all([
        getMojangCape(playerData.uuid),
        getOptifineCape(playerData.ign)
    ]);

    const badges = [];
    if (mojangCape) {
        const img = await loadFirstAvailableImage([mojangCape.url]);
        if (img) badges.push({ label: mojangCape.label, img, cropFrontFace: true, custom: false });
    }
    if (optifineCape) {
        badges.push({ label: optifineCape.label, img: optifineCape.img, cropFrontFace: false, custom: false });
    }

    if (badges.length === 0) {
        // ولا كيب رسمي ولا أوبتيفاين -> نعرض كيبنا الخاص بدل الفراغ
        badges.push({ label: 'Custom Cape', custom: true });
    }

    // ممكن تزود هنا بادجات تانية مستقبلاً (دونور، OG..الخ) بنفس الشكل { label, custom, img }
    return badges;
}

/**
 * أيقونات مرسومة بالـ Canvas (Vector) بدل الإيموجي
 * السبب: سيرفرات النود ما بتحتوي خط إيموجي ملوّن، فبتظهر كصندوق/كود (tofu)
 * الأيقونات دي بترسم بخطوط ودوائر، فبتظهر صحيحة 100% على أي سيرفر
 */
function drawStarIcon(ctx, cx, cy, outerR, color) {
    const innerR = outerR * 0.45;
    const spikes = 5;
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
        let x = cx + Math.cos(rot) * outerR;
        let y = cy + Math.sin(rot) * outerR;
        ctx.lineTo(x, y);
        rot += step;
        x = cx + Math.cos(rot) * innerR;
        y = cy + Math.sin(rot) * innerR;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
}

function drawCoinIcon(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.font = `bold ${Math.round(r * 1.15)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', cx, cy + 1);
    ctx.restore();
}

function drawGlobeIcon(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.lineWidth = Math.max(1.5, r * 0.13);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.42, r, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r * 0.4);
    ctx.lineTo(cx + r, cy - r * 0.4);
    ctx.moveTo(cx - r, cy + r * 0.4);
    ctx.lineTo(cx + r, cy + r * 0.4);
    ctx.stroke();
    ctx.restore();
}

function drawStatIcon(ctx, type, cx, cy, r, color) {
    if (type === 'star') drawStarIcon(ctx, cx, cy, r, color);
    else if (type === 'coin') drawCoinIcon(ctx, cx, cy, r, color);
    else if (type === 'globe') drawGlobeIcon(ctx, cx, cy, r, color);
}

function rgbToHex(r, g, b) {
    const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function adjustColor(hex, factor = 1) {
    const normalized = String(hex || '').replace('#', '');
    if (normalized.length !== 6) return '#ffffff';
    const r = parseInt(normalized.slice(0, 2), 16) * factor;
    const g = parseInt(normalized.slice(2, 4), 16) * factor;
    const b = parseInt(normalized.slice(4, 6), 16) * factor;
    return rgbToHex(r, g, b);
}

function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            default:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }

    return { h, s, l };
}

function extractPaletteFromImage(ctx, img, w = 36, h = 36) {
    try {
        const sample = createCanvas(w, h);
        const sctx = sample.getContext('2d');
        sctx.drawImage(img, 0, 0, w, h);
        const data = sctx.getImageData(0, 0, w, h).data;
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        let bestSat = -1;
        let accent = { r: 255, g: 215, b: 0 };

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            if (a < 140) continue;

            const brightness = (r + g + b) / 3;
            if (brightness < 20 || brightness > 245) continue;

            const { s, l } = rgbToHsl(r, g, b);
            if (s > bestSat && l > 0.18 && l < 0.85) {
                bestSat = s;
                accent = { r, g, b };
            }

            sumR += r;
            sumG += g;
            sumB += b;
            count++;
        }

        if (!count) {
            return { primary: '#FFD700', secondary: '#00E5FF', soft: 'rgba(255, 215, 0, 0.25)' };
        }

        const avg = { r: sumR / count, g: sumG / count, b: sumB / count };
        return {
            primary: rgbToHex(accent.r, accent.g, accent.b),
            secondary: rgbToHex(avg.r, avg.g, avg.b),
            soft: `rgba(${Math.round(accent.r)}, ${Math.round(accent.g)}, ${Math.round(accent.b)}, 0.28)`
        };
    } catch {
        return { primary: '#FFD700', secondary: '#00E5FF', soft: 'rgba(255, 215, 0, 0.25)' };
    }
}

/**
 * يرسم الكيب الحقيقي (Mojang/OptiFine) جوة مساحة محددة
 * لو cropFrontFace=true بنقص الواجهة الأمامية بس من ملف التيكستشر (الشكل القياسي بتاع Mojang: 64x32)
 * لو false بنرسم الصورة كلها بنسبتها الأصلية (لأن OptiFine بيرجع صيغ مختلفة)
 */
function drawCapeImage(ctx, badge, x, y, maxW, maxH) {
    ctx.save();
    ctx.imageSmoothingEnabled = false; // يحافظ على شكل البكسل الأصلي بدون تشويش وقت التكبير
    if (badge.cropFrontFace) {
        ctx.drawImage(badge.img, 1, 1, 10, 16, x, y, maxW, maxH);
    } else {
        const ratio = badge.img.width / badge.img.height;
        let w = maxW, h = maxW / ratio;
        if (h > maxH) { h = maxH; w = maxH * ratio; }
        ctx.drawImage(badge.img, x + (maxW - w) / 2, y + (maxH - h) / 2, w, h);
    }
    ctx.restore();
}

/**
 * كيب مصمم خاص بالبوت لو اللاعب ما عنده كيب حقيقي
 * إطار الكيب الأصلي (نفس الشكل المعنّش بالأسفل) + شعار الـ"P" بالمنتصف بدل النجمة
 */
function drawCustomCape(ctx, x, y, w, h, accentColor) {
    ctx.save();
    const notch = h * 0.12;

    // ---- إطار الكيب الخلفي ----
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - notch);
    ctx.lineTo(x + w * 0.5, y + h);
    ctx.lineTo(x, y + h - notch);
    ctx.closePath();

    const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
    bgGrad.addColorStop(0, 'rgba(35, 30, 15, 0.95)');
    bgGrad.addColorStop(1, 'rgba(10, 10, 12, 0.95)');
    ctx.fillStyle = bgGrad;
    ctx.fill();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // ---- الشعار في منتصف الكيب ----
    drawLogoMark(ctx, x + w / 2, y + h * 0.42, Math.min(w, h) * 0.9);

    ctx.restore();
}

/**
 * يرسم شعار الـ"P" (مرسوم بالكامل بالـ Canvas، بدون أي صورة خارجية) بتدرج برتقالي-وردي
 */
function drawLogoMark(ctx, cx, cy, size, colorStart, colorEnd) {
    ctx.save();

    const W = size * 0.8;
    const H = size;
    const ox = cx - W / 2;
    const oy = cy - H / 2;

    const grad = ctx.createLinearGradient(ox, oy, ox, oy + H);
    grad.addColorStop(0, colorStart || '#ff6a3d'); // برتقالي
    grad.addColorStop(1, colorEnd || '#e8124d');   // وردي/أحمر
    ctx.fillStyle = grad;

    // ---- الجزء العلوي (الحلقة) ----
    const bowlR = W * 0.46;
    const bowlCx = ox + W - bowlR;
    const bowlCy = oy + H * 0.30;

    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(bowlCx, oy);
    ctx.arc(bowlCx, bowlCy, bowlR, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(ox + W * 0.30, oy + H * 0.60);
    ctx.lineTo(ox, oy + H * 0.36);
    ctx.closePath();
    ctx.fill();

    // ---- الساق (الذيل المائل بالأسفل) ----
    ctx.beginPath();
    ctx.moveTo(ox, oy + H * 0.36);
    ctx.lineTo(ox + W * 0.30, oy + H * 0.60);
    ctx.lineTo(ox + W * 0.30, oy + H);
    ctx.lineTo(ox + W * 0.08, oy + H * 0.85);
    ctx.lineTo(ox, oy + H * 0.74);
    ctx.closePath();
    ctx.fill();

    // ---- تفريغ الدائرة (الفتحة وسط الحلقة) ----
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(bowlCx, bowlCy, bowlR * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.restore();
}
/**
 * يرسم صف البادجات (الكيبات) تحت السكن - العرض بيتقسم تلقائي حسب عدد البادجات
 * كده لو ضفت بادج جديد في buildCapeBadges مش محتاج تلمس الدالة دي
 */
function drawBadgesRow(ctx, badges, areaX, areaY, areaW, areaH, accentColor) {
    const gap = 16;
    const count = badges.length;
    const badgeW = (areaW - gap * (count - 1)) / count;

    badges.forEach((badge, i) => {
        const bx = areaX + i * (badgeW + gap);
        const by = areaY;

        // إطار البادج (نفس ستايل صناديق الإحصائيات)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.beginPath();
        ctx.roundRect(bx, by, badgeW, areaH, 16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.stroke();

        // مساحة صورة الكيب فوق، التسمية تحت
        const imgAreaH = areaH * 0.7;
        const capeH = imgAreaH - 10;
        const capeW = capeH * (10 / 16);
        const capeX = bx + (badgeW - capeW) / 2;
        const capeY = by + 8;

        if (badge.custom) {
            drawCustomCape(ctx, capeX, capeY, capeW, capeH, accentColor);
        } else {
            drawCapeImage(ctx, badge, capeX, capeY, capeW, capeH);
        }

        ctx.font = '15px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.textAlign = 'center';
        ctx.fillText(badge.label, bx + badgeW / 2, by + areaH - 12);
        ctx.textAlign = 'left';
    });
}

/**
 * توليد بطاقة اللاعب بتصميم فخم
 */
async function generatePlayerCard(ign, template = 'glass', serverConfig = null, options = {}) {
    const width = 1000;
    const height = 550;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const playerData = await getPlayerData(ign, serverConfig);
    const labels = options.labels || {};
    const texts = {
        notFound: labels.notFound || 'Player not found',
        level: labels.level || 'Level',
        balance: labels.balance || 'Balance',
        server: labels.server || 'Server',
        verified: labels.verified || 'VERIFIED',
        online: labels.online || 'ONLINE',
        offline: labels.offline || 'OFFLINE',
        systemFooter: labels.systemFooter || 'PROMCBOT SYSTEM',
    };
    if (!playerData) {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(texts.notFound, width / 2, height / 2);
        return canvas.toBuffer();
    }

    // 1. الخلفية (Background)
    try {
        const bgUrl = serverConfig?.wallpaper || "https://i.ibb.co/TBVZycXV/2.png";
        const background = await loadImage(bgUrl);
        ctx.drawImage(background, 0, 0, width, height);
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

    // 3. سكن اللاعب (Player Skin Render) - بيجرب أكثر من API لحد ما ياخد صورة شغالة
    const skinImg = await loadFirstAvailableImage(buildSkinCandidates(playerData));
    const columnX = 50, columnW = 420; // عمود السكن والبادجات (نفس العرض)
    const skinSize = 260;
    const badgesGapTop = 15;
    const badgesH = 95;
    const blockH = skinSize + badgesGapTop + badgesH; // السكن + البادجات كبلوك واحد
    const blockTop = panelY + (panelH - blockH) / 2; // نتوسط الكل عموديًا داخل اللوحة
    const skinX = columnX + (columnW - skinSize) / 2; // السكن في النص أفقيًا
    const skinY = blockTop;
    let theme = { primary: '#FFD700', secondary: '#00E5FF', soft: 'rgba(255, 215, 0, 0.25)' };
    if (skinImg) {
        theme = extractPaletteFromImage(ctx, skinImg);
        ctx.save();
        ctx.shadowColor = theme.soft;
        ctx.shadowBlur = 40;
        ctx.drawImage(skinImg, skinX, skinY, skinSize, skinSize);
        ctx.restore();
    } else {
        // لو كل الـ APIs فشلت، نرسم سيلويت بسيطة بدل ما نسيب الفراغ
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.roundRect(skinX, skinY, skinSize, skinSize, 24);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = `bold ${Math.round(skinSize * 0.33)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('?', skinX + skinSize / 2, skinY + skinSize / 2 + skinSize * 0.12);
        ctx.textAlign = 'left';
        ctx.restore();
    }

    const overlay = ctx.createLinearGradient(0, 0, width, height);
    overlay.addColorStop(0, 'rgba(0, 0, 0, 0.86)');
    overlay.addColorStop(0.5, `${theme.soft.replace('0.28', '0.18').replace('0.25', '0.18')}`);
    overlay.addColorStop(1, 'rgba(0, 0, 0, 0.82)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.beginPath();
    ctx.roundRect(12, 12, width - 24, height - 24, 28);
    ctx.fill();
    ctx.strokeStyle = adjustColor(theme.primary, 1.05);
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3.5 الكيب (Cape Badges) - بيفحص Mojang و OptiFine، ولو مفيش كيب حقيقي يعرض كيب البوت الخاص
    const capeBadges = await buildCapeBadges(playerData);
    drawBadgesRow(ctx, capeBadges, columnX, skinY + skinSize + badgesGapTop, columnW, badgesH, theme.primary);

    // 4. معلومات اللاعب (Player Information)
    const infoX = 500;
    
    // الاسم (IGN) مع توهج ذهبي
    ctx.save();
    ctx.shadowColor = theme.soft;
    ctx.shadowBlur = 15;
    ctx.fillStyle = adjustColor(theme.primary, 1.08);
    ctx.font = 'bold 75px Arial';
    ctx.fillText(playerData.ign, infoX, 140);
    ctx.restore();

    // حالة الاتصال (Status Badge)
    const statusText = playerData.customApi ? (playerData.isOnline ? texts.online : texts.offline) : texts.verified;
    const statusColor = (playerData.customApi && !playerData.isOnline) ? "#FF4B2B" : adjustColor(theme.primary, 1.12);
    
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
    const statsY = 222; // رفعنا الفريمات لفوق شوية
    const rowGap = 80;  // مسافة أقصر بين الفريمات
    const stats = [
        { label: texts.level, value: playerData.level !== undefined ? `[${playerData.level}★]` : "N/A", icon: "star", color: adjustColor(theme.secondary, 1.2) },
        { label: texts.balance, value: playerData.balance !== undefined ? `$${playerData.balance.toLocaleString()}` : "N/A", icon: "coin", color: adjustColor(theme.primary, 1.06) },
        { label: texts.server, value: serverConfig?.serverName || "Lobby", icon: "globe", color: '#C4B5FD' }
    ];

    stats.forEach((stat, i) => {
        const y = statsY + (i * rowGap);

        // صندوق الإحصائية
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.beginPath();
        ctx.roundRect(infoX, y, 420, 70, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.stroke();

        // الأيقونة (مرسومة، مش إيموجي نص)
        const iconCx = infoX + 42;
        const iconCy = y + 35;
        drawStatIcon(ctx, stat.icon, iconCx, iconCy, 16, stat.color);

        // العنوان
        ctx.font = '24px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(stat.label, infoX + 70, y + 43);

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
    ctx.fillText(`${serverConfig?.javaIP || 'play.server.com'} • ${texts.systemFooter}`, width / 2, height - 65);

    return canvas.toBuffer();
}

module.exports = { getPlayerData, generatePlayerCard };
