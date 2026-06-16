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
        
        return {
            uuid,
            ign: profileResponse.data.name,
            skinUrl: `https://crafatar.com/avatars/${uuid}?size=256&overlay=true`,
            headUrl: `https://crafatar.com/avatars/${uuid}?size=128&overlay=true`
        };
    } catch (error) {
        console.error('Error fetching player data:', error.message);
        return null;
    }
}

async function generatePlayerCard(ign, template = 'darkmode') {
    const width = 800;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Get player data
    const playerData = await getPlayerData(ign);
    if (!playerData) {
        // Fallback: Create error card
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
        // Create gradient background
        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        if (template === 'glass') {
            bgGradient.addColorStop(0, '#1a1a2e');
            bgGradient.addColorStop(0.5, '#16213e');
            bgGradient.addColorStop(1, '#0f3460');
        } else {
            bgGradient.addColorStop(0, '#0a0e27');
            bgGradient.addColorStop(0.5, '#1a1f3a');
            bgGradient.addColorStop(1, '#0f111b');
        }
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        // Add texture overlay
        const texturePattern = ctx.createLinearGradient(0, 0, width, height);
        texturePattern.addColorStop(0, 'rgba(255, 255, 255, 0.02)');
        texturePattern.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
        ctx.fillStyle = texturePattern;
        ctx.fillRect(0, 0, width, height);
    } catch (e) {
        ctx.fillStyle = '#0f111b';
        ctx.fillRect(0, 0, width, height);
    }

    // 2. Panel Design
    const panelX = 20;
    const panelY = 20;
    const panelW = width - 40;
    const panelH = height - 40;

    if (template === 'glass') {
        // Glass Template
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 20);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Glass shine effect
        const shine = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
        shine.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        shine.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
        shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = shine;
        ctx.fillRect(panelX + 10, panelY + 8, panelW - 20, 1);
    } else {
        // Darkmode Template
        ctx.fillStyle = 'rgba(20, 24, 45, 0.9)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 20);
        ctx.fill();

        ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Gold accent line
        const accent = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
        accent.addColorStop(0, 'rgba(212, 175, 55, 0.8)');
        accent.addColorStop(0.5, 'rgba(212, 175, 55, 0.2)');
        accent.addColorStop(1, 'rgba(212, 175, 55, 0)');
        ctx.fillStyle = accent;
        ctx.fillRect(panelX + 15, panelY + 8, panelW - 30, 2);
    }

    // 3. Player Avatar
    const avatarX = 50;
    const avatarY = 50;
    const avatarSize = 200;

    try {
        const avatar = await loadImage(playerData.headUrl);
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(212, 175, 55, 0.4)';
        ctx.beginPath();
        ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 15);
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
    } catch (e) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, 15);
        ctx.fill();
    }

    // 4. Player Info
    const infoX = avatarX + avatarSize + 40;
    const infoY = 70;

    // Player Name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 40px "Minecraft", Arial';
    ctx.textAlign = 'left';
    ctx.fillText(playerData.ign, infoX, infoY + 50);

    // UUID
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '14px Arial';
    ctx.fillText(`UUID: ${playerData.uuid.substring(0, 8)}...${playerData.uuid.substring(24)}`, infoX, infoY + 80);

    // Status Badge
    ctx.fillStyle = 'rgba(34, 224, 138, 0.2)';
    ctx.strokeStyle = '#22E08A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(infoX, infoY + 100, 120, 35, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#22E08A';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ACTIVE', infoX + 60, infoY + 122);

    // Stats
    const statsX = infoX;
    const statsY = infoY + 160;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Joined: 2024', statsX, statsY);
    ctx.fillText('Level: 50', statsX + 200, statsY);

    // Footer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`PROMCBOT • ${new Date().getFullYear()}`, width - 40, height - 25);

    return canvas.toBuffer();
}

module.exports = {
    getPlayerData,
    generatePlayerCard
};
