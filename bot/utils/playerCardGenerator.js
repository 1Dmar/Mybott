const { createCanvas, loadImage, registerFont } = require('canvas');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Register fonts
const fontsDir = path.join(__dirname, '../src/fonts');
if (fs.existsSync(path.join(fontsDir, 'd.ttf'))) {
    registerFont(path.join(fontsDir, 'd.ttf'), { family: 'Minecraft' });
}

async function getPlayerData(ign) {
    try {
        const uuidResponse = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${ign}`, { timeout: 5000 });
        const uuid = uuidResponse.data.id;

        const profileResponse = await axios.get(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`, { timeout: 5000 });

        return {
            uuid,
            ign: profileResponse.data.name,
            skinUrl: `https://crafatar.com/renders/body/${uuid}?size=512&overlay=true`,
            headUrl: `https://crafatar.com/avatars/${uuid}?size=128&overlay=true`
        };
    } catch (error) {
        console.error('Error fetching player data:', error.message);
        return null;
    }
}

/**
 * Try multiple skin APIs in order. Returns a loaded image or null.
 * Priority: crafty.gg → visage.surgeplay.com → crafatar body
 */
async function loadSkinBust(uuid, ign) {
    const apis = [
        // crafty.gg — high quality 3D bust, may be blocked by CF on some hosts
        {
            url: `https://render.crafty.gg/3d/bust/${uuid}`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://render.crafty.gg/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            }
        },
        // visage — open-source, very reliable
        {
            url: `https://visage.surgeplay.com/bust/512/${uuid}`,
            headers: { 'User-Agent': 'PROMCBOT/1.0' }
        },
        // starlightskins — another public option
        {
            url: `https://api.starlightskins.lunareclipse.studio/render/bust/${uuid}/full`,
            headers: { 'User-Agent': 'PROMCBOT/1.0' }
        },
        // crafatar full body as last resort
        {
            url: `https://crafatar.com/renders/body/${uuid}?size=512&overlay=true`,
            headers: { 'User-Agent': 'PROMCBOT/1.0' }
        }
    ];

    for (const api of apis) {
        try {
            console.log(`[Skin] Trying: ${api.url}`);
            const response = await axios.get(api.url, {
                responseType: 'arraybuffer',
                headers: api.headers,
                timeout: 8000
            });
            if (response.status === 200 && response.data.byteLength > 500) {
                const img = await loadImage(Buffer.from(response.data));
                console.log(`[Skin] Success: ${api.url}`);
                return img;
            }
        } catch (e) {
            console.warn(`[Skin] Failed (${api.url}): ${e.message}`);
        }
    }
    return null;
}

async function generatePlayerCard(ign, template = 'darkmode', stats = null) {
    const width = 800;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Get player data
    const playerData = await getPlayerData(ign);
    if (!playerData) {
        ctx.fillStyle = '#0f111b';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Player Not Found', width / 2, height / 2);
        return canvas.toBuffer();
    }

    // ── 1. Background ────────────────────────────────────────────────────────
    try {
        const bgUrl = "https://i.ibb.co/TBVZycXV/2.png";
        const background = await loadImage(bgUrl);
        ctx.drawImage(background, 0, 0, width, height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, width, height);
    } catch (e) {
        ctx.fillStyle = '#0f111b';
        ctx.fillRect(0, 0, width, height);
    }

    // ── 2. Main Panel ────────────────────────────────────────────────────────
    const panelX = 30;
    const panelY = 30;
    const panelW = width - 60;
    const panelH = height - 60;

    if (template === 'glass') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    } else {
        ctx.fillStyle = 'rgba(15, 15, 25, 0.85)';
    }
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 30);
    ctx.fill();
    ctx.strokeStyle = template === 'glass' ? 'rgba(255,255,255,0.2)' : 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── 3. Skin with 3D Pop-out Effect ───────────────────────────────────────
    //
    // Layout:
    //   Frame sits at (frameX, frameY) with size (frameW × frameH).
    //   The bust image is drawn larger and positioned so the HEAD sticks
    //   above the frame top, and the ARMS extend beyond the frame sides.
    //   We draw in 3 passes:
    //     Pass A – clip to FRAME, draw bust (body inside frame)
    //     Pass B – NO clip, draw bust again but only head+arm regions visible
    //              (achieved by clipping to the complementary region)
    //     Pass C – re-stroke frame border on top for depth
    //
    const frameX = 40;
    const frameY = 90;
    const frameW = 175;
    const frameH = 195;
    const frameRadius = 18;

    // Bust image placement — bigger than the frame so parts overflow
    const bustW = 260;
    const bustH = 260;
    // Centre the bust over the frame, shifted up so head protrudes more
    const bustX = frameX + (frameW - bustW) / 2;
    const bustY = frameY - 55; // head protrudes ~55px above frame top

    const skinImg = await loadSkinBust(playerData.uuid, playerData.ign);

    if (skinImg) {
        // Pass A: body inside the frame
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(frameX, frameY, frameW, frameH, frameRadius);
        ctx.clip();
        // subtle inner glow / dark bg inside frame
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(frameX, frameY, frameW, frameH);
        ctx.drawImage(skinImg, bustX, bustY, bustW, bustH);
        ctx.restore();

        // Pass B: head & arms that pop out above/beside the frame
        // We re-draw the full bust but clip to everything OUTSIDE the frame
        // using an "inverse clip" trick with the evenodd fill rule.
        ctx.save();
        ctx.beginPath();
        // Outer bounding box (covers entire canvas)
        ctx.rect(0, 0, width, height);
        // Frame hole (subtracted via evenodd)
        ctx.roundRect(frameX, frameY, frameW, frameH, frameRadius);
        ctx.clip('evenodd');
        ctx.drawImage(skinImg, bustX, bustY, bustW, bustH);
        ctx.restore();

        // Pass C: re-stroke frame on top so it appears in front of skin
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(frameX, frameY, frameW, frameH, frameRadius);
        ctx.stroke();

        // Subtle shadow under frame for depth
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 6;
        ctx.strokeStyle = 'rgba(0,0,0,0)';
        ctx.beginPath();
        ctx.roundRect(frameX, frameY, frameW, frameH, frameRadius);
        ctx.stroke();
        ctx.restore();
    } else {
        // Fallback placeholder
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.roundRect(frameX, frameY, frameW, frameH, frameRadius);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Skin unavailable', frameX + frameW / 2, frameY + frameH / 2);
    }

    // ── 4. Header ────────────────────────────────────────────────────────────
    const contentX = 240;
    ctx.textAlign = 'left';

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 45px "Minecraft", Arial';
    ctx.fillText(`✔ ${playerData.ign}`, contentX, 90);

    ctx.fillStyle = '#00FFFF';
    ctx.font = '22px "Minecraft", Arial';
    ctx.fillText('Level: [516★]', contentX, 130);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '18px Arial';
    ctx.fillText('EXP Progress: 2,983/5,000', contentX, 160);

    // Progress Bar
    const barX = contentX, barY = 175, barW = 300, barH = 15;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 5);
    ctx.fill();
    ctx.fillStyle = '#00FFFF';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * 0.6, barH, 5);
    ctx.fill();

    // ── 5. Right Stats ───────────────────────────────────────────────────────
    const statsX = 555;
    const statsY = 80;
    ctx.font = '18px "Minecraft", Arial';

    const rightStats = [
        { label: 'Coins', value: '637,608', color: '#FFA500' },
        { label: 'Loot Chests', value: '158', color: '#FFFF00' },
        { label: 'Iron', value: '1.18M', color: '#C0C0C0' },
        { label: 'Gold', value: '191,203', color: '#FFD700' },
        { label: 'Diamonds', value: '26,661', color: '#00FFFF' },
        { label: 'Emeralds', value: '10,891', color: '#00FF00' }
    ];

    rightStats.forEach((stat, i) => {
        ctx.fillStyle = stat.color;
        ctx.fillText(`• ${stat.label}: ${stat.value}`, statsX, statsY + i * 30);
    });

    // ── 6. BedWars Stats Grid ────────────────────────────────────────────────
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF5555';
    ctx.font = 'bold 28px "Minecraft", Arial';
    ctx.fillText('BedWars Stats (Overall)', width / 2 + 50, 260);

    const gridX = 250;
    const gridY = 300;
    const colW = 170;
    const rowH = 90;

    const gameStats = [
        [{ l: 'Wins', v: '3,506', c: '#55FF55' }, { l: 'Losses', v: '3,410', c: '#FF5555' }, { l: 'WLR', v: '1.03', c: '#FFAA00' }],
        [{ l: 'Final Kills', v: '11,595', c: '#55FF55' }, { l: 'Final Deaths', v: '3,391', c: '#FF5555' }, { l: 'FKDR', v: '3.42', c: '#FFAA00' }],
        [{ l: 'Kills', v: '19,330', c: '#55FF55' }, { l: 'Deaths', v: '27,105', c: '#FF5555' }, { l: 'KDR', v: '0.71', c: '#FFAA00' }]
    ];

    gameStats.forEach((row, rowIndex) => {
        row.forEach((stat, colIndex) => {
            const x = gridX + colIndex * colW;
            const y = gridY + rowIndex * rowH;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeRect(x - colW / 2 + 10, y - 30, colW - 20, rowH - 10);

            ctx.fillStyle = stat.c;
            ctx.font = '16px "Minecraft", Arial';
            ctx.fillText(stat.l, x, y);
            ctx.font = 'bold 24px "Minecraft", Arial';
            ctx.fillText(stat.v, x, y + 35);
        });
    });

    // ── 7. Footer ────────────────────────────────────────────────────────────
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '14px Arial';
    ctx.fillText('statsify.net | PROMCBOT', width / 2 + 50, height - 50);

    return canvas.toBuffer();
}

module.exports = { getPlayerData, generatePlayerCard };
