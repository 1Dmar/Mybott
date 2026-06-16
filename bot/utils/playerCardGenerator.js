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
        // Get UUID from IGN
        const uuidResponse = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${ign}`, { timeout: 5000 });
        const uuid = uuidResponse.data.id;

        // Get player profile
        const profileResponse = await axios.get(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`, { timeout: 5000 });
        
        // Try to fetch Hypixel stats if possible (Optional, using placeholders for now as requested by design)
        // In a real scenario, you'd use Hypixel API here.
        
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

async function generatePlayerCard(ign, template = 'darkmode') {
    const width = 800;
    const height = 600; // Increased height for better design
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

    // 1. Background
    try {
        // Background Image (Blurred Minecraft landscape)
        const bgUrl = "https://i.ibb.co/TBVZycXV/2.png";
        const background = await loadImage(bgUrl);
        ctx.drawImage(background, 0, 0, width, height);
        
        // Dark Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, width, height);
    } catch (e) {
        ctx.fillStyle = '#0f111b';
        ctx.fillRect(0, 0, width, height);
    }

    // 2. Main Panel
    const panelX = 30;
    const panelY = 30;
    const panelW = width - 60;
    const panelH = height - 60;

    if (template === 'glass') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 30);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
    } else {
        ctx.fillStyle = 'rgba(15, 15, 25, 0.85)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 30);
        ctx.fill();
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // 3. Player Render (3D Bust with Pop-out Effect)
    const skinX = 20;
    const skinY = 40;
    const skinSize = 220;
    
    try {
        const bustUrl = `https://render.crafty.gg/3d/bust/${playerData.ign}`;
        const skinImage = await loadImage(bustUrl);
        
        // Frame dimensions for the skin
        const frameX = skinX + 20;
        const frameY = skinY + 60;
        const frameW = 160;
        const frameH = 180;
        const frameRadius = 20;

        // Draw Frame Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.roundRect(frameX, frameY, frameW, frameH, frameRadius);
        ctx.fill();

        // 3D Pop-out effect implementation:
        // The goal is to have the body inside the frame and hands/head popping out.
        // We use a specific clipping region for the body.
        
        ctx.save();
        // Create a clipping path that covers the frame area
        ctx.beginPath();
        ctx.roundRect(frameX, frameY, frameW, frameH, frameRadius);
        ctx.clip();
        
        // Draw the full skin image inside the clip (this shows the body)
        ctx.drawImage(skinImage, skinX, skinY, skinSize, skinSize);
        ctx.restore();

        // Now draw the parts that should be OUTSIDE the frame (popping out)
        // We create a clipping path that excludes the frame's vertical middle part 
        // OR simply draw the head and hands area.
        // For render.crafty.gg/3d/bust, the hands are on the sides.
        
        ctx.save();
        // 1. Pop out the head (top part)
        ctx.beginPath();
        ctx.rect(skinX, skinY, skinSize, frameY - skinY + 5); // Area above frame
        
        // 2. Pop out the hands (left and right sides)
        // We expand the hand area slightly to ensure they are visible
        // Left hand area
        ctx.rect(skinX - 10, frameY, frameX - skinX + 10, frameH); 
        // Right hand area
        ctx.rect(frameX + frameW, frameY, skinX + skinSize - (frameX + frameW) + 10, frameH);
        
        ctx.clip();
        ctx.drawImage(skinImage, skinX, skinY, skinSize, skinSize);
        ctx.restore();

        // Draw Frame Stroke on top to give depth
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(frameX, frameY, frameW, frameH, frameRadius);
        ctx.stroke();
    } catch (e) {
        // Fallback to original body render if bust fails
        try {
            const body = await loadImage(playerData.skinUrl);
            ctx.drawImage(body, 20, 40, 200, 400);
        } catch (err) {}
    }

    // 4. Header Section
    const contentX = 230;
    ctx.textAlign = 'left';
    
    // Name with Checkmark
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 45px "Minecraft", Arial';
    ctx.fillText(`✔ ${playerData.ign}`, contentX, 90);

    // Level & Progress
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

    // 5. Stats Grid (Right Side)
    const statsX = 550;
    const statsY = 80;
    ctx.font = '18px "Minecraft", Arial';
    
    const stats = [
        { label: 'Coins', value: '637,608', color: '#FFA500' },
        { label: 'Loot Chests', value: '158', color: '#FFFF00' },
        { label: 'Iron', value: '1.18M', color: '#C0C0C0' },
        { label: 'Gold', value: '191,203', color: '#FFD700' },
        { label: 'Diamonds', value: '26,661', color: '#00FFFF' },
        { label: 'Emeralds', value: '10,891', color: '#00FF00' }
    ];

    stats.forEach((stat, i) => {
        ctx.fillStyle = stat.color;
        ctx.fillText(`• ${stat.label}: ${stat.value}`, statsX, statsY + (i * 30));
    });

    // 6. Game Stats (BedWars Style)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF5555';
    ctx.font = 'bold 28px "Minecraft", Arial';
    ctx.fillText('BedWars Stats (Overall)', width / 2 + 50, 260);

    const gridX = 250;
    const gridY = 300;
    const colW = 170;
    const rowH = 90;

    const gameStats = [
        [ { l: 'Wins', v: '3,506', c: '#55FF55' }, { l: 'Losses', v: '3,410', c: '#FF5555' }, { l: 'WLR', v: '1.03', c: '#FFAA00' } ],
        [ { l: 'Final Kills', v: '11,595', c: '#55FF55' }, { l: 'Final Deaths', v: '3,391', c: '#FF5555' }, { l: 'FKDR', v: '3.42', c: '#FFAA00' } ],
        [ { l: 'Kills', v: '19,330', c: '#55FF55' }, { l: 'Deaths', v: '27,105', c: '#FF5555' }, { l: 'KDR', v: '0.71', c: '#FFAA00' } ]
    ];

    gameStats.forEach((row, rowIndex) => {
        row.forEach((stat, colIndex) => {
            const x = gridX + (colIndex * colW);
            const y = gridY + (rowIndex * rowH);
            
            // Draw Box
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeRect(x - colW/2 + 10, y - 30, colW - 20, rowH - 10);
            
            ctx.fillStyle = stat.c;
            ctx.font = '16px "Minecraft", Arial';
            ctx.fillText(stat.l, x, y);
            ctx.font = 'bold 24px "Minecraft", Arial';
            ctx.fillText(stat.v, x, y + 35);
        });
    });

    // Footer
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '14px Arial';
    ctx.fillText('statsify.net | PROMCBOT', width / 2 + 50, height - 50);

    return canvas.toBuffer();
}

module.exports = {
    getPlayerData,
    generatePlayerCard
};
