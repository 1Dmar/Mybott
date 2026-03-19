const client = require("../index");
const {
    InteractionType,
    ModalBuilder,
    TextInputBuilder,
    AttachmentBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder
} = require('discord.js');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const Jimp = require('jimp');
const Serverdb = require('../Models/Server');
const Langs = require("../Models/Langs");
const Server = require('../Models/User');
const StatusBar = require('../Models/StatusBar');
const BlackList = require("../Models/BlackList");

// Custom emojis
const EMOJIS = {
    BEDROCK: '<:Bedrock:1410147921676075038>',
    OFFLINE: '<:Offline:1410178629098278922>',
    ONLINE: '<:Online:1410178650070061096>',
    PLAYER: '<:Player:1410147631308603494>',
    INFORMATION: '<:Information:1410147645883678763>',
    ACHIEVEMENT: '<:Achievement:1410147661008605224>',
    CHECK: '<:Check:1410147529630289960>',
    JAVA: '<:Java:1410147547363934300>',
    WARNING: '<:Warning:1410147601281581118>',
    BLOCK: '<:Block:1410147617056362558>'
};

// Translation file path
const tsPath = path.join(__dirname, "..", "public", "json", "translations.json");
let translations = {};

try {
    translations = JSON.parse(fs.readFileSync(tsPath, 'utf8'));
} catch (error) {
    console.error('Error loading translations:', error);
}

// Fast-loading wallpapers (optimized for speed)
const WALLPAPERS = [
    "https://wallpapercave.com/wp/wp10819450.jpg",
    "https://static1.srcdn.com/wordpress/wp-content/uploads/2022/05/Minecraft-Shader-Pine-Forest.jpg",
    "https://resourcepack.net/fl/images/2022/11/RedHat-Shaders-for-minecraft-5.jpg",
    "https://i.ibb.co/KpWg3FHw/687d56199156581-664cf6f062769.png",
    "https://i.ibb.co/qLWGYkdL/c19988205236151-Y3-Jvc-Cwx-Mz-Ez-LDEw-Mjcs-Nj-I0-LDA.png"
];

// Helper function for safe HTTP requests
async function safeAxiosGet(url, options = {}) {
    try {
        const response = await axios.get(url, {
            timeout: 5000,
            validateStatus: status => status < 500,
            ...options
        });
        return response;
    } catch (error) {
        console.log(`Request failed for ${url}:`, error.message);
        return null;
    }
}

// Function to get translated message with proper fallbacks
async function getTranslatedMessage(guildId, messageKey) {
    try {
        // Default to English if no guild ID provided
        if (!guildId) return translations['en']?.[messageKey] || messageKey;
        
        const userLang = await Langs.findOne({ guildId });
        const language = userLang ? userLang.language : 'en';
        
        // Return translation if available, otherwise English, otherwise the key itself
        return translations[language]?.[messageKey] || 
               translations['en']?.[messageKey] || 
               messageKey;
    } catch (error) {
        console.error('Error getting translation:', error);
        return translations['en']?.[messageKey] || messageKey;
    }
}

// تنظيف الـ IP من البادئات المختلفة
function cleanIP(ip) {
    if (!ip) return ip;
    return ip.replace(/^(play\.|mc\.|node\d+\.|server\.)/i, '');
}

// Improved server status checking with multiple fallbacks
async function checkServerStatus(ip, port, type) {
    if (!ip) return { success: false, error: new Error('No IP provided') };
    
    const cleanIp = cleanIP(ip);
    const endpoints = [];
    
    // Java servers
    if (type === 'java') {
        // Try different API endpoints and IP variations
        endpoints.push(`https://api.mcsrvstat.us/3/${cleanIp}:${port}`);
        endpoints.push(`https://api.mcsrvstat.us/2/${cleanIp}:${port}`);
        endpoints.push(`https://api.mcsrvstat.us/1/${cleanIp}:${port}`);
        
        // Aternos servers support
        endpoints.push(`https://api.aternos.org/v2/server/${cleanIp}`);
        endpoints.push(`https://aternosapi.creativeserver.me/${cleanIp}`);
    } 
    // Bedrock servers
    else if (type === 'bedrock') {
        endpoints.push(`https://api.mcsrvstat.us/bedrock/3/${cleanIp}:${port}`);
        endpoints.push(`https://api.mcsrvstat.us/bedrock/2/${cleanIp}:${port}`);
    }

    let lastError;
    for (const endpoint of endpoints) {
        try {
            const response = await safeAxiosGet(endpoint, { timeout: 10000 });
            if (response && response.data) {
                // معالجة خاصة لـ Aternos
                if (endpoint.includes('aternos')) {
                    if (response.data.online !== undefined) {
                        return {
                            success: true,
                            data: {
                                online: response.data.online,
                                hostname: cleanIp,
                                players: {
                                    online: response.data.players?.online || 0,
                                    max: response.data.players?.max || 0
                                },
                                version: response.data.version || 'Unknown',
                                motd: response.data.motd || 'Aternos Server'
                            },
                            source: endpoint
                        };
                    }
                } else if (response.data.online || response.data.hostname) {
                    return {
                        success: true,
                        data: response.data,
                        source: endpoint
                    };
                }
            }
        } catch (error) {
            lastError = error;
            continue;
        }
    }
    
    // If all endpoints failed, try direct ping for Java servers
    if (type === 'java') {
        try {
            const response = await safeAxiosGet(`https://api.minetools.eu/ping/${cleanIp}/${port}`, { timeout: 10000 });
            if (response && response.data && response.data.latency) {
                return {
                    success: true,
                    data: {
                        online: true,
                        hostname: cleanIp,
                        players: {
                            online: response.data.players.online || 0,
                            max: response.data.players.max || 0
                        },
                        version: response.data.version || 'Unknown',
                        motd: response.data.description || 'A Minecraft Server'
                    },
                    source: 'minetools'
                };
            }
        } catch (error) {
            // Ignore this error, we'll use the lastError from the previous attempts
        }
    }
    
    return {
        success: false,
        error: lastError || new Error('All endpoints failed'),
        data: {
            online: false,
            hostname: cleanIp,
            players: {
                online: 0,
                max: 0
            }
        }
    };
}

// Enhanced server status image generator with better error handling
const { createCanvas, loadImage, registerFont } = require('canvas');


// تسجيل الخطوط المخصصة
registerFont(path.join(__dirname, '../src/fonts/d.ttf'), { family: 'Minecraft' });
registerFont(path.join(__dirname, '../src/fonts/f.ttf'), { family: 'MinecraftBold' });

// Enhanced server status image generator with Canvas
async function generateServerStatusImage(serverData, wallpaperUrl, interaction, isPreview = false) {
    try {
        const canvasWidth = 690;
        const canvasHeight = 180;
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');

        // تحميل خلفية الصورة
        try {
            const background = await loadImage(wallpaperUrl);
            // رسم الخلفية مع تغيير حجمها
            ctx.drawImage(background, 0, 0, canvasWidth, canvasHeight);
        } catch (error) {
            console.log('Using fallback gradient background due to error:', error.message);
            // Fallback to gradient background
            const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
            gradient.addColorStop(0, '#2F3136');
            gradient.addColorStop(1, '#23272A');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        let serverStatus;
        
        if (isPreview) {
            // Use sample data for preview
            serverStatus = {
                success: true,
                data: {
                    online: true,
                    hostname: serverData.javaIP || serverData.bedrockIP || 'play.example.com',
                    players: {
                        online: 24,
                        max: 100
                    },
                    version: '1.19.2',
                    icon: null,
                    motd: {
                        raw: ["§6FreeCraft §7§l| §7Webseite: §awww.freecraft.eu §f[ §551.7 §f+ §551.8§f ]"]
                    }
                }
            };
        } else if (serverData.serverType === 'java' && serverData.javaIP) {
            serverStatus = await checkServerStatus(serverData.javaIP, serverData.javaPort || 25565, 'java');
        } else if (serverData.serverType === 'bedrock' && serverData.bedrockIP) {
            serverStatus = await checkServerStatus(serverData.bedrockIP, serverData.bedrockPort || 19132, 'bedrock');
        }

        // Server icon
        try {
            const serverIconUrl = isPreview 
                ? 'https://api.mcstatus.io/v2/icon/minecraft.net'
                : `https://api.mcstatus.io/v2/icon/${cleanIP(serverData.javaIP || serverData.bedrockIP)}:${serverData.javaPort || serverData.bedrockPort || 25565}`;
            
            const serverIcon = await loadImage(serverIconUrl);
            
            // رسم أيقونة دائرية
            ctx.save();
            ctx.beginPath();
            ctx.arc(52, 50, 32, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(serverIcon, 20, 18, 64, 64);
            ctx.restore();
        } catch (error) {
            console.log('Using fallback server icon due to error:', error.message);
            // رسم دائرة زرقاء بديلة
            ctx.fillStyle = '#7289DA';
            ctx.beginPath();
            ctx.arc(52, 50, 32, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fill();
        }

        // Server info
        const serverName = isPreview 
            ? (serverData.serverName || 'Example Server') 
            : (serverData.serverName || 'Minecraft Server');
            
        const isOnline = isPreview ? true : (serverStatus ? serverStatus.success : false);
        
        // Status indicator
        ctx.fillStyle = isOnline ? '#00FF00' : '#FF0000';
        ctx.beginPath();
        ctx.arc(canvasWidth - 20, 30, 10, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        
        // Server name
        ctx.font = 'bold 20px MinecraftBold';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(serverName, 100, 40);
        
        // Player count (if server is online)
        if (isOnline) {
            const playerCount = isPreview 
                ? { online: 24, max: 100 } 
                : (serverStatus && serverStatus.data.players ? serverStatus.data.players : { online: 0, max: 0 });
                
            const playerText = await getTranslatedMessage(interaction.guild?.id, "PLAYERS");
            const playerCountText = `${playerText}: ${playerCount.online}/${playerCount.max}`;
            
            ctx.font = '16px Minecraft';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(playerCountText, canvasWidth - ctx.measureText(playerCountText).width - 20, 40);
        }

        // إضافة MOTD ملون في منتصف الصورة
        if (serverStatus && serverStatus.data) {
            try {
                const motdData = serverStatus.data.motd || serverStatus.data.description;
                let motdText = '';
                
                // استخراج نص MOTD من البيانات المختلفة
                if (typeof motdData === 'string') {
                    motdText = motdData;
                } else if (motdData.clean && Array.isArray(motdData.clean)) {
                    motdText = motdData.clean.join('\n');
                } else if (motdData.raw && Array.isArray(motdData.raw)) {
                    motdText = motdData.raw.join('\n');
                } else {
                    motdText = 'A Minecraft Server';
                }
                
                // تحويل الرموز Unicode إلى رموز ماينكرافت العادية
                motdText = motdText.replace(/\\u00a7/g, '§');
                
                // تقسيم MOTD إلى أسطر
                const motdLines = [];
                let currentLine = '';
                
                for (const line of motdText.split('\n')) {
                    const words = line.split(' ');
                    for (const word of words) {
                        const testLine = currentLine ? `${currentLine} ${word}` : word;
                        ctx.font = '16px Minecraft';
                        const testWidth = ctx.measureText(testLine.replace(/§./g, '')).width;
                        
                        if (testWidth > (canvasWidth - 100) && currentLine) {
                            motdLines.push(currentLine);
                            currentLine = word;
                        } else {
                            currentLine = testLine;
                        }
                    }
                    if (currentLine) {
                        motdLines.push(currentLine);
                        currentLine = '';
                    }
                }
                
                if (currentLine) motdLines.push(currentLine);
                
                // إذا كان هناك الكثير من الأسطر، نأخذ أول 3 أسطر فقط
                const displayLines = motdLines.slice(0, 3);
                
                // حساب موضع MOTD في منتصف الصورة
                const lineHeight = 20;
                const totalMotdHeight = displayLines.length * lineHeight;
                const motdY = (canvasHeight - totalMotdHeight) / 2;
                
                // دالة لتحويل رموز ماينكرافت إلى ألوان Canvas
                function getMinecraftColor(code) {
                    const colors = {
                        '0': '#000000', // Black
                        '1': '#0000AA', // Dark Blue
                        '2': '#00AA00', // Dark Green
                        '3': '#00AAAA', // Dark Aqua
                        '4': '#AA0000', // Dark Red
                        '5': '#AA00AA', // Dark Purple
                        '6': '#FFAA00', // Gold
                        '7': '#AAAAAA', // Gray
                        '8': '#555555', // Dark Gray
                        '9': '#5555FF', // Blue
                        'a': '#55FF55', // Green
                        'b': '#55FFFF', // Aqua
                        'c': '#FF5555', // Red
                        'd': '#FF55FF', // Light Purple
                        'e': '#FFFF55', // Yellow
                        'f': '#FFFFFF', // White
                        'r': '#FFFFFF'  // Reset (White)
                    };
                    return colors[code] || '#FFFFFF';
                }
                
                // رسم كل سطر من MOTD مع الألوان
                for (let i = 0; i < displayLines.length; i++) {
                    const line = displayLines[i];
                    if (line && line.length > 0) {
                        // حساب العرض الإجمالي للنص بدون رموز التنسيق
                        const cleanLine = line.replace(/§./g, '');
                        ctx.font = '16px Minecraft';
                        const totalWidth = ctx.measureText(cleanLine).width;
                        let currentX = (canvasWidth - totalWidth) / 2;
                        let currentColor = '#FFFFFF'; // لون افتراضي (أبيض)
                        
                        // معالجة كل حرف في السطر مع الألوان
                        let j = 0;
                        while (j < line.length) {
                            if (line[j] === '§' && j + 1 < line.length) {
                                // هذا رمز لون، غير اللون الحالي
                                const colorCode = line[j + 1].toLowerCase();
                                currentColor = getMinecraftColor(colorCode);
                                j += 2; // تخطي رمز اللون
                            } else {
                                // طباعة الحرف باللون الحالي
                                const char = line[j];
                                
                                ctx.font = '16px Minecraft';
                                ctx.fillStyle = currentColor;
                                ctx.fillText(char, currentX, motdY + (i * lineHeight));
                                
                                currentX += ctx.measureText(char).width;
                                j++;
                            }
                        }
                    }
                }
            } catch (error) {
                console.log('Error processing colored MOTD:', error);
                // في حالة الخطأ، اطبع MOTD عادي بدون ألوان
                try {
                    const motdData = serverStatus.data.motd || serverStatus.data.description;
                    let motdText = '';
                    
                    if (typeof motdData === 'string') {
                        motdText = motdData;
                    } else if (motdData.clean && Array.isArray(motdData.clean)) {
                        motdText = motdData.clean.join('\n');
                    } else {
                        motdText = 'A Minecraft Server';
                    }
                    
                    // تنظيف النص من رموز التنسيق
                    const cleanMotd = motdText.replace(/§./g, '').replace(/\\u00a7./g, '');
                    const motdLines = cleanMotd.split('\n').filter(line => line.trim().length > 0);
                    
                    if (motdLines.length === 0) {
                        motdLines.push("A Minecraft Server");
                    }
                    
                    const lineHeight = 20;
                    const totalMotdHeight = motdLines.length * lineHeight;
                    const motdY = (canvasHeight - totalMotdHeight) / 2;
                    
                    ctx.font = '16px Minecraft';
                    ctx.fillStyle = '#FFFFFF';
                    
                    for (let i = 0; i < motdLines.length; i++) {
                        const line = motdLines[i];
                        if (line && line.length > 0) {
                            const lineWidth = ctx.measureText(line).width;
                            const x = (canvasWidth - lineWidth) / 2;
                            ctx.fillText(line, x, motdY + (i * lineHeight));
                        }
                    }
                } catch (fallbackError) {
                    console.log('Fallback MOTD also failed:', fallbackError);
                }
            }
        }

        // العلامة المائية
        ctx.font = '14px Minecraft';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        const watermarkText = "ProMcBot Api";
        const watermarkWidth = ctx.measureText(watermarkText).width;
        ctx.fillText(watermarkText, canvasWidth - watermarkWidth - 10, canvasHeight - 10);

        // Add "PREVIEW" text if it's a preview
        if (isPreview) {
            ctx.font = 'bold 20px MinecraftBold';
            ctx.fillStyle = '#FFFFFF';
            const previewText = "PREVIEW";
            const previewWidth = ctx.measureText(previewText).width;
            ctx.fillText(previewText, (canvasWidth - previewWidth) / 2, 20);
        }

        return canvas.toBuffer();
    } catch (error) {
        console.error('Error generating server status image:', error);
        
        // Create a simple error image as fallback
        const canvas = createCanvas(800, 200);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#2F3136';
        ctx.fillRect(0, 0, 800, 200);
        
        ctx.font = '16px Minecraft';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText("Error generating server status image", 50, 100);
        
        return canvas.toBuffer();
    }
}

// Modern wallpaper selection with improved design
async function generateWallpaperSelectionCard(wallpapers, interaction) {
    try {
        const cardWidth = 600;
        const cardHeight = 400;
        
        const card = new Jimp(cardWidth, cardHeight, 0x2F3136FF);
        
        // Add title with gradient background
        const titleBackground = new Jimp(cardWidth, 60, 0x7289DAFF);
        card.blit(titleBackground, 0, 0);
        
        // Add title - use default font to avoid errors
        const title = await getTranslatedMessage(interaction.guild?.id, "SELECT_WALLPAPER") || "Select a Wallpaper";
        const titleWidth = Jimp.measureText(Jimp.FONT_SANS_32_WHITE, title);
        card.print(Jimp.FONT_SANS_32_WHITE, (cardWidth - titleWidth) / 2, 15, title);
        
        // Create thumbnails for each wallpaper in a grid
        const thumbnailSize = 100;
        const thumbnailsPerRow = 3;
        const spacing = 20;
        const startY = 80;
        
        for (let i = 0; i < Math.min(wallpapers.length, 9); i++) {
            const row = Math.floor(i / thumbnailsPerRow);
            const col = i % thumbnailsPerRow;
            
            const x = 50 + col * (thumbnailSize + spacing);
            const y = startY + row * (thumbnailSize + spacing);
            
            try {
                const response = await safeAxiosGet(wallpapers[i], { 
                    responseType: 'arraybuffer'
                });
                
                if (response && response.status === 200 && response.data) {
                    const thumbnail = await Jimp.read(Buffer.from(response.data));
                    thumbnail.resize(thumbnailSize, thumbnailSize);
                    
                    // Add border manually
                    const borderColor = 0x7289DAFF;
                    for (let bx = 0; bx < thumbnail.bitmap.width; bx++) {
                        for (let by = 0; by < 3; by++) {
                            thumbnail.setPixelColor(borderColor, bx, by);
                            thumbnail.setPixelColor(borderColor, bx, thumbnail.bitmap.height - 1 - by);
                        }
                    }
                    for (let by = 0; by < thumbnail.bitmap.height; by++) {
                        for (let bx = 0; bx < 3; bx++) {
                            thumbnail.setPixelColor(borderColor, bx, by);
                            thumbnail.setPixelColor(borderColor, thumbnail.bitmap.width - 1 - bx, by);
                        }
                    }
                    
                    card.blit(thumbnail, x, y);
                    
                    // Add number with circle background
                    const numberBg = new Jimp(30, 30, 0x7289DAFF);
                    // Draw circle manually for number background
                    const numCenterX = 15;
                    const numCenterY = 15;
                    const numRadius = 12;
                    for (let ny = 0; ny < 30; ny++) {
                        for (let nx = 0; nx < 30; nx++) {
                            const distance = Math.sqrt(Math.pow(nx - numCenterX, 2) + Math.pow(ny - numCenterY, 2));
                            if (distance <= numRadius) {
                                numberBg.setPixelColor(0xFFFFFFFF, nx, ny);
                            }
                        }
                    }
                    card.blit(numberBg, x + thumbnailSize - 25, y + thumbnailSize - 25);
                    card.print(Jimp.FONT_SANS_16_BLACK, x + thumbnailSize - 20, y + thumbnailSize - 20, `${i+1}`);
                } else {
                    throw new Error('Failed to load wallpaper');
                }
            } catch (error) {
                console.log('Using placeholder for wallpaper', i+1, 'due to error:', error.message);
                // Create a placeholder if the wallpaper fails to load
                const placeholder = new Jimp(thumbnailSize, thumbnailSize, 0x7289DAFF);
                card.blit(placeholder, x, y);
                card.print(Jimp.FONT_SANS_16_WHITE, x + thumbnailSize/2 - 5, y + thumbnailSize/2 - 8, `${i+1}`);
            }
        }
        
        // Add instructions
        const instructionText = await getTranslatedMessage(interaction.guild?.id, "WALLPAPER_INSTRUCTIONS") || "Select a wallpaper from the menu below";
        const instructionWidth = Jimp.measureText(Jimp.FONT_SANS_16_WHITE, instructionText);
        card.print(Jimp.FONT_SANS_16_WHITE, (cardWidth - instructionWidth) / 2, cardHeight - 40, instructionText);
        
        return await card.getBufferAsync(Jimp.MIME_PNG);
    } catch (error) {
        console.error('Error generating wallpaper selection card:', error);
        return null;
    }
}

// Handle interactions with improved error handling
client.on('interactionCreate', async (interaction) => {
    try {
        // Handle slash commands first
        if (interaction.isChatInputCommand()) {
            const command = client.scommands.get(interaction.commandName);
            
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return await interaction.reply({ 
                    content: `${EMOJIS.WARNING} ${await getTranslatedMessage(interaction.guild?.id, "COMMAND_NOT_AVAILABLE") || "This command is not available."}`, 
                    ephemeral: true 
                });
            }

            try {
                // Defer reply for commands that might take time
                if (command.deferReply) {
                    await interaction.deferReply({ ephemeral: command.ephemeral || false });
                }
                
                console.log(`Executing command: ${interaction.commandName}`);
                await command.run(client, interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}:`, error);
                
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle(await getTranslatedMessage(interaction.guild?.id, "COMMAND_ERROR") || "Command Error")
                    .setDescription(await getTranslatedMessage(interaction.guild?.id, "COMMAND_EXECUTION_ERROR") || "There was an error while executing this command!")
                    .setTimestamp();
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ 
                        embeds: [errorEmbed], 
                        ephemeral: true 
                    });
                } else {
                    await interaction.reply({ 
                        embeds: [errorEmbed], 
                        ephemeral: true 
                    });
                }
            }
            return;
        }
        
        // Handle other interactions
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'serverType') {
                const serverType = interaction.values[0];
                
                // Store the server type for later use
                client.tempData = client.tempData || {};
                client.tempData[interaction.user.id] = {
                    serverType: serverType,
                    step: 'serverTypeSelected'
                };
                
                const modal = new ModalBuilder()
                    .setCustomId('serverModal')
                    .setTitle(await getTranslatedMessage(interaction.guild?.id, "SERVER_INFORMATION") || "Server Information");

                if (serverType === 'java') {
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('serverName')
                                .setLabel(await getTranslatedMessage(interaction.guild?.id, "SERVER_NAME") || "Server Name")
                                .setStyle(TextInputStyle.Short)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('javaIP')
                                .setLabel(await getTranslatedMessage(interaction.guild?.id, "JAVA_SERVER_IP") || "Java Server IP")
                                .setStyle(TextInputStyle.Short)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('javaPort')
                                .setLabel(await getTranslatedMessage(interaction.guild?.id, "JAVA_SERVER_PORT") || "Java Server Port")
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder('25565')
                                .setRequired(false)
                        )
                    );
                } else if (serverType === 'bedrock') {
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('serverName')
                                .setLabel(await getTranslatedMessage(interaction.guild?.id, "SERVER_NAME") || "Server Name")
                                .setStyle(TextInputStyle.Short)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('bedrockIP')
                                .setLabel(await getTranslatedMessage(interaction.guild?.id, "BEDROCK_SERVER_IP") || "Bedrock Server IP")
                                .setStyle(TextInputStyle.Short)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('bedrockPort')
                                .setLabel(await getTranslatedMessage(interaction.guild?.id, "BEDROCK_SERVER_PORT") || "Bedrock Server Port")
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder('19132')
                                .setRequired(false)
                        )
                    );
                } else if (serverType === 'custom') {
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('serverName')
                                .setLabel(await getTranslatedMessage(interaction.guild?.id, "SERVER_NAME") || "Server Name")
                                .setStyle(TextInputStyle.Short)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('javaIP')
                                .setLabel(`${await getTranslatedMessage(interaction.guild?.id, "JAVA_SERVER_IP")} (Optional)` || "Java Server IP (Optional)")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('javaPort')
                                .setLabel(`${await getTranslatedMessage(interaction.guild?.id, "JAVA_SERVER_PORT")} (Optional)` || "Java Server Port (Optional)")
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder('25565')
                                .setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('bedrockIP')
                                .setLabel(`${await getTranslatedMessage(interaction.guild?.id, "BEDROCK_SERVER_IP")} (Optional)` || "Bedrock Server IP (Optional)")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('bedrockPort')
                                .setLabel(`${await getTranslatedMessage(interaction.guild?.id, "BEDROCK_SERVER_PORT")} (Optional)` || "Bedrock Server Port (Optional)")
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder('19132')
                                .setRequired(false)
                        )
                    );
                }

                await interaction.showModal(modal);
            } else if (interaction.customId === 'wallpaperSelect') {
                await interaction.deferReply({ ephemeral: true });
                
                const selectedIndex = parseInt(interaction.values[0].replace('wallpaper_', ''));
                const selectedWallpaper = WALLPAPERS[selectedIndex];
                
                if (!selectedWallpaper) {
                    const errorMessage = await getTranslatedMessage(interaction.guild?.id, "INVALID_WALLPAPER") || "Invalid wallpaper selection.";
                    return interaction.editReply({
                        content: `${EMOJIS.WARNING} ${errorMessage}`,
                        ephemeral: true
                    });
                }
                
                // Store the selected wallpaper
                client.tempData[interaction.user.id].wallpaper = selectedWallpaper;
                
                // Generate preview with the selected wallpaper
                const previewBuffer = await generateServerStatusImage(
                    client.tempData[interaction.user.id].serverData, 
                    selectedWallpaper, 
                    interaction,
                    true // isPreview
                );
                
                const attachment = new AttachmentBuilder(previewBuffer, { name: `wallpaper_preview_${selectedIndex}.png` });
                
                const confirmButton = new ButtonBuilder()
                    .setCustomId('confirmWallpaper')
                    .setLabel(await getTranslatedMessage(interaction.guild?.id, "CONFIRM_WALLPAPER") || "Use This Wallpaper")
                    .setStyle(ButtonStyle.Primary);
                    
                const chooseAnotherButton = new ButtonBuilder()
                    .setCustomId('chooseAnotherWallpaper')
                    .setLabel(await getTranslatedMessage(interaction.guild?.id, "CHOOSE_ANOTHER") || "Choose Another")
                    .setStyle(ButtonStyle.Secondary);
                    
                const buttonRow = new ActionRowBuilder().addComponents(confirmButton, chooseAnotherButton);

                const previewMessage = await getTranslatedMessage(interaction.guild?.id, "WALLPAPER_PREVIEW") || "Preview of your selected wallpaper:";
                await interaction.editReply({
                    content: `${EMOJIS.INFORMATION} ${previewMessage}`,
                    files: [attachment],
                    components: [buttonRow],
                    ephemeral: true
                });
            }
        } else if (interaction.isModalSubmit() && interaction.customId === 'serverModal') {
            await interaction.deferReply({ ephemeral: true });
            
            const serverType = client.tempData[interaction.user.id].serverType;
            const serverId = interaction.guild.id;
            const serverName = interaction.fields.getTextInputValue('serverName') || 'Unknown';
            
            let javaIP = null;
            let javaPort = 25565;
            let bedrockIP = null;
            let bedrockPort = 19132;
            
            // Safely get field values based on server type
            try {
                if (serverType === 'java' || serverType === 'custom') {
                    javaIP = interaction.fields.getTextInputValue('javaIP') || null;
                    const javaPortValue = interaction.fields.getTextInputValue('javaPort');
                    if (javaPortValue) javaPort = javaPortValue;
                }
                
                if (serverType === 'bedrock' || serverType === 'custom') {
                    bedrockIP = interaction.fields.getTextInputValue('bedrockIP') || null;
                    const bedrockPortValue = interaction.fields.getTextInputValue('bedrockPort');
                    if (bedrockPortValue) bedrockPort = bedrockPortValue;
                }
            } catch (error) {
                console.error('Error getting field values:', error);
                // Handle missing fields gracefully
                if (error.code === 'ModalSubmitInteractionFieldNotFound') {
                    // If a field is missing, it's likely because it wasn't included in the modal
                    // We can continue with default values
                    console.log('Field not found, using default values');
                } else {
                    throw error;
                }
            }
            
            // Determine server type based on provided inputs
            let finalServerType = serverType;
            if (serverType === 'custom') {
                if (javaIP && !bedrockIP) finalServerType = 'java';
                if (!javaIP && bedrockIP) finalServerType = 'bedrock';
            }
            
            const serverData = {
                serverId,
                serverName,
                javaIP,
                javaPort,
                bedrockIP,
                bedrockPort,
                serverType: finalServerType
            };
            
            // Store server data
            client.tempData[interaction.user.id] = {
                ...client.tempData[interaction.user.id],
                serverData: serverData,
                step: 'serverDataEntered'
            };
            
            // Generate wallpaper selection card
            const selectionCard = await generateWallpaperSelectionCard(WALLPAPERS, interaction);
            
            if (selectionCard) {
                const cardAttachment = new AttachmentBuilder(selectionCard, { name: 'wallpaper_selection.png' });
                
                const wallpaperOptions = WALLPAPERS.map((url, index) => ({
                    label: `Wallpaper ${index + 1}`,
                    description: `Select wallpaper #${index + 1}`,
                    value: `wallpaper_${index}`
                }));
                
                const wallpaperSelect = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('wallpaperSelect')
                            .setPlaceholder(await getTranslatedMessage(interaction.guild?.id, "SELECT_WALLPAPER") || 'Choose a wallpaper...')
                            .addOptions(wallpaperOptions.slice(0, 25)) // Discord limit
                    );
                
                await interaction.editReply({
                    content: `${EMOJIS.INFORMATION} ${await getTranslatedMessage(interaction.guild?.id, "SELECT_WALLPAPER_DESCRIPTION") || "Please select a wallpaper for your server status image:"}`,
                    files: [cardAttachment],
                    components: [wallpaperSelect],
                    ephemeral: true
                });
            } else {
                // Fallback to text-based selection if card generation fails
                const wallpaperOptions = WALLPAPERS.map((url, index) => ({
                    label: `Wallpaper ${index + 1}`,
                    description: `Select wallpaper #${index + 1}`,
                    value: `wallpaper_${index}`
                }));
                
                const wallpaperSelect = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('wallpaperSelect')
                            .setPlaceholder(await getTranslatedMessage(interaction.guild?.id, "SELECT_WALLPAPER") || 'Choose a wallpaper...')
                            .addOptions(wallpaperOptions.slice(0, 25)) // Discord limit
                    );
                
                await interaction.editReply({
                    content: `${EMOJIS.INFORMATION} ${await getTranslatedMessage(interaction.guild?.id, "SELECT_WALLPAPER_DESCRIPTION") || "Please select a wallpaper for your server status image:"}`,
                    components: [wallpaperSelect],
                    ephemeral: true
                });
            }
        } else if (interaction.isButton()) {
            if (interaction.customId === 'confirmWallpaper') {
                await interaction.deferReply({ ephemeral: true });
                
                const serverData = client.tempData[interaction.user.id].serverData;
                const wallpaper = client.tempData[interaction.user.id].wallpaper;
                
                // Generate final server status image
                const imageBuffer = await generateServerStatusImage(serverData, wallpaper, interaction, false);
                const attachment = new AttachmentBuilder(imageBuffer, { 
                    name: `${serverData.serverName.replace(/[^a-zA-Z0-9]/g, '_')}_status.png` 
                });
                
                const confirmButton = new ButtonBuilder()
                    .setCustomId('confirmServer')
                    .setLabel(await getTranslatedMessage(interaction.guild?.id, "CONFIRM") || "Confirm")
                    .setStyle(ButtonStyle.Primary);
                    
                const cancelButton = new ButtonBuilder()
                    .setCustomId('cancelServer')
                    .setLabel(await getTranslatedMessage(interaction.guild?.id, "CANCEL") || "Cancel")
                    .setStyle(ButtonStyle.Danger);
                    
                const buttonRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

                await interaction.editReply({
                    content: `${EMOJIS.INFORMATION} ${await getTranslatedMessage(interaction.guild?.id, "SERVER_STATUS_READY") || "Server status image ready!"}`,
                    files: [attachment],
                    components: [buttonRow],
                    ephemeral: true
                });
            } else if (interaction.customId === 'chooseAnotherWallpaper') {
                await interaction.deferReply({ ephemeral: true });
                
                // Regenerate wallpaper selection card
                const selectionCard = await generateWallpaperSelectionCard(WALLPAPERS, interaction);
                
                if (selectionCard) {
                    const cardAttachment = new AttachmentBuilder(selectionCard, { name: 'wallpaper_selection.png' });
                    
                    const wallpaperOptions = WALLPAPERS.map((url, index) => ({
                        label: `Wallpaper ${index + 1}`,
                        description: `Select wallpaper #${index + 1}`,
                        value: `wallpaper_${index}`
                    }));
                    
                    const wallpaperSelect = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('wallpaperSelect')
                                .setPlaceholder(await getTranslatedMessage(interaction.guild?.id, "SELECT_WALLPAPER") || 'Choose a wallpaper...')
                                .addOptions(wallpaperOptions.slice(0, 25))
                        );
                    
                    await interaction.editReply({
                        content: `${EMOJIS.INFORMATION} ${await getTranslatedMessage(interaction.guild?.id, "SELECT_WALLPAPER_DESCRIPTION") || "Please select a wallpaper for your server status image:"}`,
                        files: [cardAttachment],
                        components: [wallpaperSelect],
                        ephemeral: true
                    });
                } else {
                    // Fallback to text-based selection
                    const wallpaperOptions = WALLPAPERS.map((url, index) => ({
                        label: `Wallpaper ${index + 1}`,
                        description: `Select wallpaper #${index + 1}`,
                        value: `wallpaper_${index}`
                    }));
                    
                    const wallpaperSelect = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('wallpaperSelect')
                                .setPlaceholder(await getTranslatedMessage(interaction.guild?.id, "SELECT_WALLPAPER") || 'Choose a wallpaper...')
                                .addOptions(wallpaperOptions.slice(0, 25))
                        );
                    
                    await interaction.editReply({
                        content: `${EMOJIS.INFORMATION} ${await getTranslatedMessage(interaction.guild?.id, "SELECT_WALLPAPER_DESCRIPTION") || "Please select a wallpaper for your server status image:"}`,
                        components: [wallpaperSelect],
                        ephemeral: true
                    });
                }
            } else if (interaction.customId === 'confirmServer') {
                const serverData = client.tempData[interaction.user.id].serverData;
                
                if (!serverData) {
                    return interaction.reply({
                        content: `${EMOJIS.WARNING} ${await getTranslatedMessage(interaction.guild?.id, "NO_SERVER_DATA") || "No server data found. Please start over."}`,
                        ephemeral: true
                    });
                }
                
                try {
                    const existingServer = await Serverdb.findOne({ serverId: serverData.serverId });
                    
                    if (existingServer) {
                        await Serverdb.updateOne({ serverId: serverData.serverId }, serverData);
                    } else {
                        await Serverdb.create(serverData);
                    }
                    
                    delete client.tempData[interaction.user.id];
                    
                    await interaction.update({
                        components: [],
                        content: `${EMOJIS.CHECK} ${await getTranslatedMessage(interaction.guild?.id, "SERVER_SAVED_SUCCESS") || "Server information saved successfully!"}`
                    });
                } catch (error) {
                    console.error('Error saving server:', error);
                    await interaction.reply({
                        content: `${EMOJIS.WARNING} ${await getTranslatedMessage(interaction.guild?.id, "SAVE_ERROR") || "Error saving server information."}`,
                        ephemeral: true
                    });
                }
            } else if (interaction.customId === 'cancelServer') {
                delete client.tempData[interaction.user.id];
                await interaction.update({
                    components: [],
                    content: `${EMOJIS.WARNING} ${await getTranslatedMessage(interaction.guild?.id, "SETUP_CANCELLED") || "Setup cancelled."}`
                });
            }
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        
        // Handle specific error types
        let errorMessage = await getTranslatedMessage(interaction.guild?.id, "PROCESSING_ERROR") || "An error occurred while processing your request.";
        
        if (error.code === 'ModalSubmitInteractionFieldNotFound') {
            errorMessage = await getTranslatedMessage(interaction.guild?.id, "FIELD_NOT_FOUND_ERROR") || "A required field was not found. Please try the setup again.";
        }
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: `${EMOJIS.WARNING} ${errorMessage}`,
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: `${EMOJIS.WARNING} ${errorMessage}`,
                ephemeral: true
            });
        }
    }
});

// Setup command
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    if (interaction.commandName === 'setup') {
        try {
            // Defer the reply to avoid "application did not respond" errors
            await interaction.deferReply({ ephemeral: true });
            
            const introMessage = await getTranslatedMessage(interaction.guild?.id, "SELECT_SERVER_TYPE") || "Select your server type:";
            
            const serverTypeSelect = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('serverType')
                        .setPlaceholder(introMessage)
                        .addOptions([
                            {
                                label: 'Java Edition',
                                description: 'Minecraft Java Edition server',
                                value: 'java',
                                emoji: '1410147547363934300'
                            },
                            {
                                label: 'Bedrock Edition',
                                description: 'Minecraft Bedrock Edition server',
                                value: 'bedrock',
                                emoji: '1410147921676075038'
                            },
                            {
                                label: 'Custom Setup',
                                description: 'Both Java and Bedrock servers',
                                value: 'custom',
                                emoji: '1410147645883678763'
                            }
                        ])
                );
            
            await interaction.editReply({
                content: `${EMOJIS.INFORMATION} ${introMessage}`,
                components: [serverTypeSelect],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error in setup command:', error);
            await interaction.editReply({
                content: `${EMOJIS.WARNING} ${await getTranslatedMessage(interaction.guild?.id, "SETUP_ERROR") || "An error occurred while setting up the server."}`,
                ephemeral: true
            });
        }
    }
});

// Prefix command for testing image generator
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Check for prefix command
    if (message.content.startsWith('!testwallpaper')) {
        try {
            await message.channel.sendTyping();
            
            // Parse the wallpaper index from command
            const args = message.content.split(' ');
            const wallpaperIndex = args[1] ? parseInt(args[1]) : 0;
            
            if (isNaN(wallpaperIndex) || wallpaperIndex < 0 || wallpaperIndex >= WALLPAPERS.length) {
                return message.reply(`Please specify a valid wallpaper index (0-${WALLPAPERS.length-1})`);
            }
            
            const selectedWallpaper = WALLPAPERS[wallpaperIndex];
            
            // Create sample server data for testing
            const sampleServerData = {
                serverName: 'Test Server',
                javaIP: 'mc.hypixel.net',
                javaPort: 25565,
                bedrockIP: null,
                bedrockPort: 19132,
                serverType: 'java'
            };
            
            // Generate test image
            const imageBuffer = await generateServerStatusImage(
                sampleServerData, 
                selectedWallpaper, 
                { guild: message.guild },
                true // isPreview
            );
            
            const attachment = new AttachmentBuilder(imageBuffer, { 
                name: `wallpaper_test_${wallpaperIndex}.png` 
            });
            
            await message.reply({
                content: `Testing wallpaper #${wallpaperIndex}: ${selectedWallpaper}`,
                files: [attachment]
            });
            
        } catch (error) {
            console.error('Error in testwallpaper command:', error);
            await message.reply('An error occurred while testing the wallpaper.');
        }
    }
    
    // Command to list available wallpapers
    if (message.content.startsWith('!listwallpapers')) {
        let response = "Available wallpapers:\n";
        WALLPAPERS.forEach((url, index) => {
            response += `${index}: ${url}\n`;
        });
        response += "\nUse `!testwallpaper <number>` to test a wallpaper.";
        
        await message.reply(response);
    }
});

module.exports = client;