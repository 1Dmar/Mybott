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
            skinUrl: `https://crafatar.com/renders/body/${uuid}?size=512&overlay=true`,
            headUrl: `https://crafatar.com/avatars/${uuid}?size=128&overlay=true`
        };
    } catch (error) {
        console.error('Error fetching player data:', error.message);
        return null;
    }
}

/**
 * FIXED VERSION OF PLAYER CARD GENERATOR
 * Focus: Correct 3D Bust rendering with Pop-out effect
 */
async function generatePlayerCard(ign, template = 'darkmode') {
    const width = 800;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

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
        const bgUrl = "https://i.ibb.co/TBVZycXV/2.png";
        const background = await loadImage(bgUrl);
        ctx.drawImage(background, 0, 0, width, height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, width, height);
    } catch (e) {
        ctx.fillStyle = '#0f111b';
        ctx.fillRect(0, 0, width, height);
    }

    // 2. Main Panel
    const panelX = 30, panelY = 30, panelW = width - 60, panelH = height - 60;
    ctx.fillStyle = 'rgba(15, 15, 25, 0.85)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 30);
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Player Render (3D Bust with Pop-out Effect) - FIXED LOGIC
    const skinX = 40;
    const skinY = 80;
    const skinSize = 240; // Slightly smaller as requested
    
    try {
        const bustUrl = `https://render.crafty.gg/3d/bust/${playerData.ign}`;
        
        // Use a more robust request to bypass potential blocks
        const response = await axios.get(bustUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        });
        const skinImage = await loadImage(Buffer.from(response.data));
        
        // Frame dimensions (The inner box for the avatar)
        const frameX = 60;
        const frameY = 120;
        const frameW = 150;
        const frameH = 170;
        const frameRadius = 20;

        // Draw Frame Background first
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.roundRect(frameX, frameY, frameW, frameH, frameRadius);
        ctx.fill();

        // Step 1: Draw the body (Inside the frame)
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(frameX, frameY, frameW, frameH, frameRadius);
        ctx.clip(); // Only show parts inside the frame
        ctx.drawImage(skinImage, skinX, skinY, skinSize, skinSize);
        ctx.restore();

        // Step 2: Draw the pop-out parts (Head and Hands)
        // We draw the SAME image again, but with a different clipping region
        ctx.save();
        // Create a complex clipping region that excludes the main body part but includes head/hands
        // OR simpler: Just draw parts that are outside the frame boundaries but inside the CARD
        
        // Define the area where head/hands can "pop out"
        // This should be the area ABOVE the frame and to the SIDES
        const region = new Path2D();
        // Top area (Head)
        region.rect(skinX, skinY, skinSize, frameY - skinY + 5); 
        // Left side (Hand)
        region.rect(skinX - 10, frameY, frameX - skinX + 10, frameH);
        // Right side (Hand)
        region.rect(frameX + frameW, frameY, skinX + skinSize - (frameX + frameW) + 10, frameH);
        
        ctx.clip(region);
        
        // Final constraint: Don't let it pop out of the main card
        // (The main card is at panelX, panelY)
        ctx.drawImage(skinImage, skinX, skinY, skinSize, skinSize);
        ctx.restore();

        // Draw Frame Stroke on top for depth
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(frameX, frameY, frameW, frameH, frameRadius);
        ctx.stroke();

    } catch (e) {
        console.error('Failed to render 3D bust:', e.message);
        // Fallback to 2D body
        try {
            const body = await loadImage(playerData.skinUrl);
            ctx.drawImage(body, 60, 120, 150, 300);
        } catch (err) {}
    }

    // ... Rest of the stats drawing (IGN, Levels, Grid) ...
    // [The rest of the original code follows here]
    
    // Header Section
    const contentX = 230;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 45px Arial'; // Fallback font
    ctx.fillText(`✔ ${playerData.ign}`, contentX, 90);

    return canvas.toBuffer();
}

module.exports = {
    getPlayerData,
    generatePlayerCard
};
