let createCanvas;
let loadImage;
let registerFont;
let rendererAvailable = false;
try {
    ({ createCanvas, loadImage, registerFont } = require('canvas'));
    rendererAvailable = typeof createCanvas === 'function' && typeof loadImage === 'function';
} catch (error) {
    // The bot can run without image rendering; only the optional player-card feature is unavailable.
    // Do not emit startup noise; callers receive a safe unavailable result.
}

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const dns = require('dns').promises;
const net = require('net');
const { normalizeMinecraftAddress } = require('./minecraftAddressPolicy');

// Register fonts if they exist
const fontsDir = path.join(__dirname, '../src/fonts');
if (fs.existsSync(path.join(fontsDir, 'd.ttf'))) {
    // registerFont(path.join(fontsDir, 'd.ttf'), { family: 'Minecraft' });
}

function isPrivateOrReservedIp(address) {
    const normalized = String(address || '').toLowerCase();
    const version = net.isIP(normalized);
    if (version === 4) {
        const octets = normalized.split('.').map(Number);
        const [a, b] = octets;
        return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
            (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) ||
            a >= 224;
    }
    if (version === 6) {
        return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') ||
            normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
            normalized.startsWith('fea') || normalized.startsWith('feb');
    }
    return false;
}

async function isPublicCustomApiHost(value) {
    const normalized = normalizeMinecraftAddress(value);
    if (!normalized) return false;
    const host = normalized.startsWith('[') ? normalized.slice(1, -1) : normalized;
    if (host === 'localhost' || host.endsWith('.local') || isPrivateOrReservedIp(host)) return false;
    if (net.isIP(host)) return true;
    try {
        const records = await dns.lookup(host, { all: true, verbatim: true });
        return records.length > 0 && records.every(record => !isPrivateOrReservedIp(record.address));
    } catch (_) {
        return false;
    }
}

/**
 * جلب بيانات اللاعب من API السيرفر (Lobby) أو Mojang كخيار بديل
 */
async function getPlayerData(ign, serverConfig = null) {
    let data = {
        ign: ign,
        uuid: null,
        isOnline: false,
        isBanned: false,
        customApi: false,
        endpointOffline: false,
        notFound: false,
        neverJoinedServer: false,
        isCracked: true,
        firstPlayed: 0,
        lastPlayed: 0,
        endpointData: null,
        skinUrl: `https://skins.mcstats.com/bust/${ign}`
    };

    try {
        // خيار أساسي: جلب البيانات الأساسية من Mojang للتأكد من حالة الحساب (أصلي/مكركة)
        try {
            const uuidResponse = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${ign}`, { timeout: 4000 });
            if (uuidResponse.data && uuidResponse.data.id) {
                data.uuid = uuidResponse.data.id;
                data.ign = uuidResponse.data.name; 
                data.isCracked = false; // حساب موجود في Mojang = أصلي
                data.skinUrl = `https://skins.mcstats.com/bust/${data.ign}`;
            }
        } catch (mojangError) {
            // تجاهل الخطأ، إذا فشل يعني الحساب غالباً مكركة
        }

        // إذا كان السيرفر يحتوي على إعدادات الـ API (Token + Port)
        if (serverConfig && serverConfig.apiToken) {
            const serverIP = serverConfig.javaIP || serverConfig.bedrockIP;
            const apiPort = Number(serverConfig.apiPort || 8080);
            const protocol = "http";

            if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535 || !(await isPublicCustomApiHost(serverIP))) {
                data.endpointOffline = true;
                return data;
            }
            
            try {
                // التأكد من وجود كلمة Bearer قبل التوكن لأن Postman يضيفها تلقائياً
                const authHeader = serverConfig.apiToken.startsWith('Bearer ') 
                    ? serverConfig.apiToken 
                    : `Bearer ${serverConfig.apiToken}`;

                // جلب معلومات اللاعب من Lobby السيرفر
                const normalizedServerIP = normalizeMinecraftAddress(serverIP);
                const response = await axios.get(`${protocol}://${normalizedServerIP}:${apiPort}/player/${encodeURIComponent(ign)}`, {
                    headers: {
                        'Authorization': authHeader,
                        'X-Premium-Key': serverConfig.premiumKey || ''
                    },
                    timeout: 5000,
                    maxRedirects: 0,
                    validateStatus: status => status >= 200 && status < 300
                });

                if (response.data && response.data.success) {
                    const serverData = response.data;
                    data.customApi = true;
                    data.isOnline = serverData.isOnline;
                    data.isBanned = serverData.isBanned;
                    data.firstPlayed = serverData.firstPlayed || 0;
                    data.lastPlayed = serverData.lastPlayed || 0;
                    data.endpointData = serverData;
                    
                    // فحص ما إذا كان اللاعب لم يدخل السيرفر من قبل
                    if (data.firstPlayed === 0 && data.lastPlayed === 0) {
                        data.neverJoinedServer = true;
                    }
                    
                    if (!data.uuid && serverData.uuid) {
                        data.uuid = serverData.uuid;
                    }
                } else if (response.data && !response.data.success) {
                    // اللاعب غير موجود في قاعدة البيانات
                    data.customApi = true;
                    data.notFound = true;
                }
            } catch (apiError) {
                console.warn(`Custom API failed for ${ign}:`, apiError.message);
                data.endpointOffline = true;
            }
        }

        return data;
    } catch (error) {
        console.error('Error fetching player data:', error.message);
        return data;
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
    const candidates = [];
    if (playerData.skinUrl) candidates.push(playerData.skinUrl);
    candidates.push(`https://skins.mcstats.com/bust/${playerData.ign}`);
    candidates.push(`https://visage.surgeplay.com/bust/512/${playerData.ign}`);
    candidates.push(`https://minotar.net/armor/bust/${playerData.ign}/512.png`);
    candidates.push(`https://mc-heads.net/body/${playerData.ign}/512`);
    candidates.push(`https://skins.mcstats.com/bust/Steve`); // fallback أخير مضمون يشتغل
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

function drawClockIcon(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.lineWidth = Math.max(1.5, r * 0.13);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - r * 0.55);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * 0.42, cy + r * 0.28);
    ctx.stroke();
    ctx.restore();
}

function drawShieldIcon(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.78, cy - r * 0.55);
    ctx.lineTo(cx + r * 0.62, cy + r * 0.45);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r * 0.62, cy + r * 0.45);
    ctx.lineTo(cx - r * 0.78, cy - r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(cx - r * 0.1, cy - r * 0.5, r * 0.2, r);
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
    else if (type === 'time') drawClockIcon(ctx, cx, cy, r, color);
    else if (type === 'shield') drawShieldIcon(ctx, cx, cy, r, color);
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
 * يرسم شارات اللاعب داخل مساحة السكن. الشارات تأتي من بيانات الحساب والسيرفر،
 * وليست Cape وهميًا أو صورة احتياطية مضللة.
 */
function drawBadgesRow(ctx, badges, areaX, areaY, areaW, areaH, accentColor) {
    const safeBadges = Array.isArray(badges) && badges.length ? badges.slice(0, 3) : [{ label: 'New Player', icon: 'star', color: accentColor }];
    const gap = 12;
    const count = safeBadges.length;
    const badgeW = (areaW - gap * (count - 1)) / count;

    safeBadges.forEach((badge, i) => {
        const bx = areaX + i * (badgeW + gap);
        const by = areaY;
        const color = badge.color || accentColor;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.beginPath();
        ctx.roundRect(bx, by, badgeW, areaH, 16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
        ctx.stroke();

        const iconX = bx + badgeW / 2;
        const iconY = by + areaH / 2;
        ctx.shadowColor = `${color}99`;
        ctx.shadowBlur = 14;
        ctx.fillStyle = `${color}22`;
        ctx.beginPath();
        ctx.arc(iconX, iconY, 27, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        drawStatIcon(ctx, badge.icon || 'star', iconX, iconY, 17, color);
    });
}

function formatCardDuration(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return '—';
    const totalMinutes = Math.floor(value / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatCardDate(value) {
    const timestamp = value instanceof Date ? value.getTime() : new Date(value || 0).getTime();
    if (!Number.isFinite(timestamp) || timestamp <= 0) return '—';
    return new Date(timestamp).toISOString().slice(0, 10);
}

function drawCardText(ctx, text, x, y, maxWidth, options = {}) {
    const value = String(text ?? '—');
    const maxSize = options.maxSize || 30;
    const minSize = options.minSize || 15;
    let size = maxSize;
    ctx.font = `${options.weight || 'bold'} ${size}px Arial`;
    while (ctx.measureText(value).width > maxWidth && size > minSize) {
        size -= 1;
        ctx.font = `${options.weight || 'bold'} ${size}px Arial`;
    }
    ctx.fillStyle = options.color || '#F8FAFF';
    ctx.fillText(value, x, y);
}

function drawPlayerApiCards(ctx, playerData) {
    const endpoint = playerData.endpointData || {};
    const profile = playerData.profileContext || {};
    const stats = endpoint.stats || profile.stats || {};
    const joins = Number.isFinite(Number(stats.joins)) ? Number(stats.joins) : null;
    const sessionSeconds = Number.isFinite(Number(stats.sessionSeconds)) ? Number(stats.sessionSeconds) : null;
    const firstPlayed = endpoint.firstPlayed || playerData.firstPlayed || profile.firstSeenAt;
    const lastPlayed = endpoint.lastPlayed || playerData.lastPlayed || profile.lastSeenAt;
    const status = playerData.isBanned ? 'Banned' : playerData.isOnline ? 'Online' : 'Offline';
    const statusColor = playerData.isBanned ? '#FF7676' : playerData.isOnline ? '#72F0B4' : '#B9C1D8';
    const cards = [
        { title: 'STATUS', value: status, detail: endpoint.serverName || profile.scopeLabel || '—' },
        { title: 'ACTIVITY', value: joins === null ? '—' : `${joins.toLocaleString()} joins`, detail: sessionSeconds === null ? 'Play time —' : `Play time ${formatCardDuration(sessionSeconds)}` },
        { title: 'LAST SEEN', value: formatCardDate(lastPlayed), detail: `First seen ${formatCardDate(firstPlayed)}` },
    ];
    const boxes = [{ x: 145, y: 585, w: 400 }, { x: 575, y: 585, w: 440 }, { x: 1045, y: 585, w: 385 }];
    cards.forEach((card, index) => {
        const box = boxes[index];
        ctx.save();
        ctx.fillStyle = 'rgba(232, 239, 255, 0.78)';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(card.title, box.x + 28, box.y + 38);
        drawCardText(ctx, card.value, box.x + 28, box.y + 72, box.w - 56, { maxSize: 30, minSize: 17, color: index === 0 ? statusColor : '#FFFFFF' });
        drawCardText(ctx, card.detail, box.x + 28, box.y + 96, box.w - 56, { maxSize: 16, minSize: 11, color: 'rgba(232, 239, 255, 0.78)', weight: 'normal' });
        ctx.restore();
    });
}

/**
 * توليد بطاقة اللاعب بتصميم فخم
 */
async function generatePlayerCard(ign, template = 'glass', serverConfig = null, profileContext = null) {
    if (!rendererAvailable) {
        throw new Error('player_card_renderer_unavailable');
    }

    const width = 1690;
    const height = 931;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const playerData = await getPlayerData(ign, serverConfig);
    if (profileContext && typeof profileContext === 'object') {
        if (profileContext.cardState !== 'server_not_configured' && playerData.endpointOffline) profileContext.cardState = 'server_offline';
        if (profileContext.accountType === 'online') playerData.isCracked = false;
        if (profileContext.accountType === 'offline') playerData.isCracked = true;
        if (typeof profileContext.isOnline === 'boolean') playerData.isOnline = profileContext.isOnline;
        if (profileContext.firstSeenAt) playerData.firstPlayed = new Date(profileContext.firstSeenAt).getTime();
        if (profileContext.lastSeenAt) playerData.lastPlayed = new Date(profileContext.lastSeenAt).getTime();
        playerData.profileContext = profileContext;
    }
    
    // 1. The supplied PNG is the fixed background and layout. Keep it unchanged.
    try {
        const template = await loadImage(path.join(__dirname, '../assets/player-card-template.png'));
        ctx.drawImage(template, 0, 0, width, height);
    } catch (_) {
        ctx.fillStyle = '#111426';
        ctx.fillRect(0, 0, width, height);
    }

    const state = playerData.profileContext?.cardState || (playerData.endpointOffline ? 'server_offline' : playerData.notFound || playerData.neverJoinedServer ? 'never_joined' : 'measured');
    const isOnline = state === 'measured' && playerData.isOnline;
    const skinImg = await loadFirstAvailableImage(buildSkinCandidates(playerData));

    // Avatar: only the checkerboard/avatar placeholder area is replaced.
    const avatarX = 245, avatarY = 238, avatarSize = 305;
    if (skinImg) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 42);
        ctx.clip();
        ctx.drawImage(skinImg, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
    }

    // Name: clear only the name field from the template, then place the live name.
    ctx.save();
    ctx.fillStyle = 'rgba(8, 14, 32, 0.82)';
    ctx.fillRect(690, 255, 525, 105);
    ctx.fillStyle = '#F8FAFF';
    ctx.font = 'bold 72px Arial';
    let nameSize = 72;
    while (ctx.measureText(playerData.ign).width > 500 && nameSize > 36) {
        nameSize -= 2;
        ctx.font = `bold ${nameSize}px Arial`;
    }
    ctx.fillText(playerData.ign, 700, 337);
    ctx.restore();

    // Account type: keep the template's position, changing only its dynamic value.
    ctx.save();
    ctx.fillStyle = 'rgba(8, 14, 32, 0.9)';
    ctx.fillRect(690, 382, 370, 58);
    ctx.fillStyle = playerData.isCracked ? '#FFB6FF' : '#72F0B4';
    ctx.font = 'bold 28px Arial';
    ctx.fillText(playerData.isCracked ? 'Cracked Account' : 'Original Account', 735, 421);
    if (!playerData.isCracked) {
        ctx.fillStyle = '#29E782';
        ctx.beginPath();
        ctx.arc(705, 409, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#071D16';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(697, 409);
        ctx.lineTo(703, 415);
        ctx.lineTo(714, 402);
        ctx.stroke();
    }
    ctx.restore();

    // Verification check: visible only for an original account, in the template's badge position.
    if (playerData.isCracked) {
        ctx.fillStyle = 'rgba(8, 14, 32, 0.9)';
        ctx.beginPath();
        ctx.arc(1245, 305, 34, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillStyle = '#247BFF';
        ctx.beginPath();
        ctx.arc(1245, 305, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(1228, 305);
        ctx.lineTo(1240, 317);
        ctx.lineTo(1263, 292);
        ctx.stroke();
    }

    // Online/offline: replace only the status text/dot in the top-right pill.
    ctx.save();
    const statusColor = isOnline ? '#00E879' : '#FF6B6B';
    ctx.fillStyle = 'rgba(17, 28, 39, 0.82)';
    ctx.fillRect(1360, 111, 250, 65);
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(1394, 143, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px Arial';
    ctx.fillText(isOnline ? 'Online' : 'Offline', 1422, 154);
    ctx.restore();

    // Fill only the three existing lower placeholders with measured Player API data.
    drawPlayerApiCards(ctx, playerData);
    return canvas.toBuffer();
}

module.exports = { getPlayerData, generatePlayerCard, rendererAvailable, isPublicCustomApiHost };
