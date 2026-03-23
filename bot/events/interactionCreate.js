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
  if (fs.existsSync(tsPath)) {
    translations = JSON.parse(fs.readFileSync(tsPath, 'utf8'));
  } else {
    console.log('⚠️ Translations file not found, using empty object');
    translations = { en: {} };
  }
} catch (error) {
  console.error('Error loading translations:', error.message);
  translations = { en: {} };
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
        if (!guildId) return translations['en']?.[messageKey] || messageKey;
        
        const userLang = await Langs.findOne({ guildId });
        const language = userLang ? userLang.language : 'en';
        
        return translations[language]?.[messageKey] || 
               translations['en']?.[messageKey] || 
               messageKey;
    } catch (error) {
        return translations['en']?.[messageKey] || messageKey;
    }
}

// Clean IP from prefixes
function cleanIP(ip) {
    if (!ip) return ip;
    return ip.replace(/^(play\.|mc\.|node\d+\.|server\.)/i, '');
}

// Server status checking with multiple fallbacks
async function checkServerStatus(ip, port, type) {
    if (!ip) return { success: false, error: new Error('No IP provided') };
    
    const cleanIp = cleanIP(ip);
    const endpoints = [];
    
    if (type === 'java') {
        endpoints.push(`https://api.mcsrvstat.us/3/${cleanIp}:${port}`);
        endpoints.push(`https://api.mcsrvstat.us/2/${cleanIp}:${port}`);
    } else if (type === 'bedrock') {
        endpoints.push(`https://api.mcsrvstat.us/bedrock/3/${cleanIp}:${port}`);
    }

    let lastError;
    for (const endpoint of endpoints) {
        try {
            const response = await safeAxiosGet(endpoint, { timeout: 10000 });
            if (response && response.data) {
                if (response.data.online || response.data.hostname) {
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
    
    return {
        success: false,
        error: lastError || new Error('All endpoints failed'),
        data: { online: false, hostname: cleanIp, players: { online: 0, max: 0 } }
    };
}

// Canvas and font setup
const { createCanvas, loadImage, registerFont } = require('canvas');

// Register fonts with proper error handling
const fontsDir = path.join(__dirname, '../src/fonts');
let fontsLoaded = false;

try {
  // Check if fonts directory exists
  if (!fs.existsSync(fontsDir)) {
    console.log('⚠️ Fonts directory not found, creating it...');
    fs.mkdirSync(fontsDir, { recursive: true });
  }
  
  // Try to register fonts if they exist
  const font1 = path.join(fontsDir, 'd.ttf');
  const font2 = path.join(fontsDir, 'f.ttf');
  
  if (fs.existsSync(font1)) {
    registerFont(font1, { family: 'Minecraft' });
    fontsLoaded = true;
  }
  if (fs.existsSync(font2)) {
    registerFont(font2, { family: 'MinecraftBold' });
    fontsLoaded = true;
  }
  
  if (!fontsLoaded) {
    console.log('⚠️ No custom fonts found in', fontsDir);
    console.log('💡 The bot will use default system fonts. Add d.ttf and f.ttf to bot/src/fonts/ for custom fonts.');
  }
} catch (fontError) {
  console.warn('⚠️ Could not load custom Minecraft fonts:', fontError.message);
}

// Server status image generator
async function generateServerStatusImage(serverData, wallpaperUrl, interaction, isPreview = false) {
    try {
        const canvasWidth = 690;
        const canvasHeight = 180;
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');

        // Load background
        try {
            const background = await loadImage(wallpaperUrl);
            ctx.drawImage(background, 0, 0, canvasWidth, canvasHeight);
        } catch (error) {
            // Fallback to gradient
            const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
            gradient.addColorStop(0, '#2F3136');
            gradient.addColorStop(1, '#23272A');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        let serverStatus;
        
        if (isPreview) {
            serverStatus = {
                success: true,
                data: {
                    online: true,
                    hostname: serverData.javaIP || serverData.bedrockIP || 'play.example.com',
                    players: { online: 24, max: 100 },
                    version: '1.19.2',
                    icon: null,
                    motd: { raw: ["§6Example Server §7| §aWelcome!"] }
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
            ctx.save();
            ctx.beginPath();
            ctx.arc(52, 50, 32, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(serverIcon, 20, 18, 64, 64);
            ctx.restore();
        } catch (error) {
            // Fallback circle
            ctx.fillStyle = '#7289DA';
            ctx.beginPath();
            ctx.arc(52, 50, 32, 0, Math.PI * 2);
            ctx.fill();
        }

        // Server info
        const serverName = isPreview ? (serverData.serverName || 'Example Server') : (serverData.serverName || 'Minecraft Server');
        const isOnline = isPreview ? true : (serverStatus ? serverStatus.success : false);
        
        // Status indicator
        ctx.fillStyle = isOnline ? '#00FF00' : '#FF0000';
        ctx.beginPath();
        ctx.arc(canvasWidth - 20, 30, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Server name - use system fonts if custom fonts not loaded
        ctx.font = fontsLoaded ? 'bold 20px MinecraftBold' : 'bold 20px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(serverName, 100, 40);
        
        // Player count
        if (isOnline) {
            const playerCount = isPreview ? { online: 24, max: 100 } : (serverStatus?.data?.players || { online: 0, max: 0 });
            const playerText = await getTranslatedMessage(interaction.guild?.id, "PLAYERS");
            const playerCountText = `${playerText}: ${playerCount.online}/${playerCount.max}`;
            
            ctx.font = fontsLoaded ? '16px Minecraft' : '16px Arial';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(playerCountText, canvasWidth - ctx.measureText(playerCountText).width - 20, 40);
        }

        // MOTD
        if (serverStatus?.data) {
            try {
                const motdData = serverStatus.data.motd || serverStatus.data.description;
                let motdText = '';
                
                if (typeof motdData === 'string') {
                    motdText = motdData;
                } else if (motdData?.clean && Array.isArray(motdData.clean)) {
                    motdText = motdData.clean.join('\n');
                } else if (motdData?.raw && Array.isArray(motdData.raw)) {
                    motdText = motdData.raw.join('\n');
                } else {
                    motdText = 'A Minecraft Server';
                }
                
                motdText = motdText.replace(/\\u00a7/g, '§');
                const cleanMotd = motdText.replace(/§./g, '');
                const motdLines = cleanMotd.split('\n').filter(line => line.trim().length > 0).slice(0, 3);
                
                if (motdLines.length === 0) motdLines.push("A Minecraft Server");
                
                const lineHeight = 20;
                const totalMotdHeight = motdLines.length * lineHeight;
                const motdY = (canvasHeight - totalMotdHeight) / 2;
                
                ctx.font = fontsLoaded ? '16px Minecraft' : '16px Arial';
                ctx.fillStyle = '#FFFFFF';
                
                for (let i = 0; i < motdLines.length; i++) {
                    const line = motdLines[i];
                    if (line?.length > 0) {
                        const lineWidth = ctx.measureText(line).width;
                        const x = (canvasWidth - lineWidth) / 2;
                        ctx.fillText(line, x, motdY + (i * lineHeight));
                    }
                }
            } catch (error) {
                console.log('Error processing MOTD:', error.message);
            }
        }

        // Watermark
        ctx.font = fontsLoaded ? '14px Minecraft' : '14px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        const watermarkText = "ProMcBot Api";
        const watermarkWidth = ctx.measureText(watermarkText).width;
        ctx.fillText(watermarkText, canvasWidth - watermarkWidth - 10, canvasHeight - 10);

        if (isPreview) {
            ctx.font = fontsLoaded ? 'bold 20px MinecraftBold' : 'bold 20px Arial';
            ctx.fillStyle = '#FFFFFF';
            const previewText = "PREVIEW";
            const previewWidth = ctx.measureText(previewText).width;
            ctx.fillText(previewText, (canvasWidth - previewWidth) / 2, 20);
        }

        return canvas.toBuffer();
    } catch (error) {
        console.error('Error generating server status image:', error);
        
        // Error fallback image
        const canvas = createCanvas(800, 200);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#2F3136';
        ctx.fillRect(0, 0, 800, 200);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText("Error generating server status image", 50, 100);
        
        return canvas.toBuffer();
    }
}

// Wallpaper selection card
async function generateWallpaperSelectionCard(wallpapers, interaction) {
    try {
        const cardWidth = 600;
        const cardHeight = 400;
        
        const card = new Jimp(cardWidth, cardHeight, 0x2F3136FF);
        
        // Title background
        const titleBackground = new Jimp(cardWidth, 60, 0x7289DAFF);
        card.blit(titleBackground, 0, 0);
        
        const title = await getTranslatedMessage(interaction.guild?.id, "SELECT_WALLPAPER") || "Select a Wallpaper";
        const titleWidth = Jimp.measureText(Jimp.FONT_SANS_32_WHITE, title);
        card.print(Jimp.FONT_SANS_32_WHITE, (cardWidth - titleWidth) / 2, 15, title);
        
        // Thumbnails
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
                const response = await safeAxiosGet(wallpapers[i], { responseType: 'arraybuffer' });
                
                if (response?.status === 200 && response.data) {
                    const thumbnail = await Jimp.read(Buffer.from(response.data));
                    thumbnail.resize(thumbnailSize, thumbnailSize);
                    card.blit(thumbnail, x, y);
                    card.print(Jimp.FONT_SANS_16_BLACK, x + thumbnailSize - 20, y + thumbnailSize - 20, `${i+1}`);
                }
            } catch (error) {
                // Placeholder
                const placeholder = new Jimp(thumbnailSize, thumbnailSize, 0x7289DAFF);
                card.blit(placeholder, x, y);
                card.print(Jimp.FONT_SANS_16_WHITE, x + thumbnailSize/2 - 5, y + thumbnailSize/2 - 8, `${i+1}`);
            }
        }
        
        return await card.getBufferAsync(Jimp.MIME_PNG);
    } catch (error) {
        console.error('Error generating wallpaper card:', error);
        return null;
    }
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        try {
            // Handle slash commands
            if (interaction.isChatInputCommand()) {
                const command = client.scommands.get(interaction.commandName);
                
                if (!command) {
                    console.error(`No command matching ${interaction.commandName} was found.`);
                    return await interaction.reply({ 
                        content: `${EMOJIS.WARNING} Command not available.`, 
                        ephemeral: true 
                    });
                }

                try {
                    if (command.deferReply) {
                        await interaction.deferReply({ ephemeral: command.ephemeral || false });
                    }
                    
                    console.log(`Executing command: ${interaction.commandName}`);
                    await command.run(client, interaction);
                } catch (error) {
                    console.error(`Error executing ${interaction.commandName}:`, error);
                    
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle("Command Error")
                        .setDescription("There was an error while executing this command!")
                        .setTimestamp();
                    
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
                    } else {
                        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                    }
                }
                return;
            }
            
            // Handle select menus
            if (interaction.isStringSelectMenu()) {
                if (interaction.customId === 'serverType') {
                    const serverType = interaction.values[0];
                    
                    client.tempData = client.tempData || {};
                    client.tempData[interaction.user.id] = {
                        serverType: serverType,
                        step: 'serverTypeSelected'
                    };
                    
                    const modal = new ModalBuilder()
                        .setCustomId('serverModal')
                        .setTitle("Server Information");

                    if (serverType === 'java') {
                        modal.addComponents(
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('serverName')
                                    .setLabel("Server Name")
                                    .setStyle(TextInputStyle.Short)
                            ),
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('javaIP')
                                    .setLabel("Java Server IP")
                                    .setStyle(TextInputStyle.Short)
                            ),
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('javaPort')
                                    .setLabel("Java Server Port")
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
                                    .setLabel("Server Name")
                                    .setStyle(TextInputStyle.Short)
                            ),
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('bedrockIP')
                                    .setLabel("Bedrock Server IP")
                                    .setStyle(TextInputStyle.Short)
                            ),
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('bedrockPort')
                                    .setLabel("Bedrock Server Port")
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
                        return interaction.editReply({
                            content: `${EMOJIS.WARNING} Invalid wallpaper selection.`,
                            ephemeral: true
                        });
                    }
                    
                    client.tempData[interaction.user.id].wallpaper = selectedWallpaper;
                    
                    const previewBuffer = await generateServerStatusImage(
                        client.tempData[interaction.user.id].serverData, 
                        selectedWallpaper, 
                        interaction,
                        true
                    );
                    
                    const attachment = new AttachmentBuilder(previewBuffer, { name: `wallpaper_preview_${selectedIndex}.png` });
                    
                    const confirmButton = new ButtonBuilder()
                        .setCustomId('confirmWallpaper')
                        .setLabel("Use This Wallpaper")
                        .setStyle(ButtonStyle.Primary);
                        
                    const chooseAnotherButton = new ButtonBuilder()
                        .setCustomId('chooseAnotherWallpaper')
                        .setLabel("Choose Another")
                        .setStyle(ButtonStyle.Secondary);
                        
                    const buttonRow = new ActionRowBuilder().addComponents(confirmButton, chooseAnotherButton);

                    await interaction.editReply({
                        content: `${EMOJIS.INFORMATION} Preview of your selected wallpaper:`,
                        files: [attachment],
                        components: [buttonRow],
                        ephemeral: true
                    });
                }
            } else if (interaction.isModalSubmit() && interaction.customId === 'serverModal') {
                await interaction.deferReply({ ephemeral: true });
                
                const serverType = client.tempData[interaction.user.id]?.serverType;
                const serverId = interaction.guild?.id;
                const serverName = interaction.fields.getTextInputValue('serverName') || 'Unknown';
                
                let javaIP = null, javaPort = 25565;
                let bedrockIP = null, bedrockPort = 19132;
                
                try {
                    if (serverType === 'java' || serverType === 'custom') {
                        javaIP = interaction.fields.getTextInputValue('javaIP') || null;
                        const javaPortValue = interaction.fields.getTextInputValue('javaPort');
                        if (javaPortValue) javaPort = parseInt(javaPortValue) || 25565;
                    }
                    
                    if (serverType === 'bedrock' || serverType === 'custom') {
                        bedrockIP = interaction.fields.getTextInputValue('bedrockIP') || null;
                        const bedrockPortValue = interaction.fields.getTextInputValue('bedrockPort');
                        if (bedrockPortValue) bedrockPort = parseInt(bedrockPortValue) || 19132;
                    }
                } catch (error) {
                    console.log('Field not found, using defaults');
                }
                
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
                
                client.tempData[interaction.user.id] = {
                    ...client.tempData[interaction.user.id],
                    serverData: serverData,
                    step: 'serverDataEntered'
                };
                
                const selectionCard = await generateWallpaperSelectionCard(WALLPAPERS, interaction);
                
                const wallpaperOptions = WALLPAPERS.map((url, index) => ({
                    label: `Wallpaper ${index + 1}`,
                    description: `Select wallpaper #${index + 1}`,
                    value: `wallpaper_${index}`
                }));
                
                const wallpaperSelect = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('wallpaperSelect')
                            .setPlaceholder('Choose a wallpaper...')
                            .addOptions(wallpaperOptions.slice(0, 25))
                    );
                
                if (selectionCard) {
                    const cardAttachment = new AttachmentBuilder(selectionCard, { name: 'wallpaper_selection.png' });
                    await interaction.editReply({
                        content: `${EMOJIS.INFORMATION} Please select a wallpaper:`,
                        files: [cardAttachment],
                        components: [wallpaperSelect],
                        ephemeral: true
                    });
                } else {
                    await interaction.editReply({
                        content: `${EMOJIS.INFORMATION} Please select a wallpaper:`,
                        components: [wallpaperSelect],
                        ephemeral: true
                    });
                }
            } else if (interaction.isButton()) {
                if (interaction.customId === 'confirmWallpaper') {
                    await interaction.deferReply({ ephemeral: true });
                    
                    const serverData = client.tempData[interaction.user.id]?.serverData;
                    const wallpaper = client.tempData[interaction.user.id]?.wallpaper;
                    
                    if (!serverData || !wallpaper) {
                        return interaction.editReply({
                            content: `${EMOJIS.WARNING} Missing server data. Please start over.`,
                            ephemeral: true
                        });
                    }
                    
                    const imageBuffer = await generateServerStatusImage(serverData, wallpaper, interaction, false);
                    const attachment = new AttachmentBuilder(imageBuffer, { 
                        name: `${serverData.serverName.replace(/[^a-zA-Z0-9]/g, '_')}_status.png` 
                    });
                    
                    const confirmButton = new ButtonBuilder()
                        .setCustomId('confirmServer')
                        .setLabel("Confirm")
                        .setStyle(ButtonStyle.Primary);
                        
                    const cancelButton = new ButtonBuilder()
                        .setCustomId('cancelServer')
                        .setLabel("Cancel")
                        .setStyle(ButtonStyle.Danger);
                        
                    const buttonRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

                    await interaction.editReply({
                        content: `${EMOJIS.INFORMATION} Server status image ready!`,
                        files: [attachment],
                        components: [buttonRow],
                        ephemeral: true
                    });
                } else if (interaction.customId === 'chooseAnotherWallpaper') {
                    await interaction.deferReply({ ephemeral: true });
                    
                    const selectionCard = await generateWallpaperSelectionCard(WALLPAPERS, interaction);
                    
                    const wallpaperOptions = WALLPAPERS.map((url, index) => ({
                        label: `Wallpaper ${index + 1}`,
                        description: `Select wallpaper #${index + 1}`,
                        value: `wallpaper_${index}`
                    }));
                    
                    const wallpaperSelect = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('wallpaperSelect')
                                .setPlaceholder('Choose a wallpaper...')
                                .addOptions(wallpaperOptions.slice(0, 25))
                        );
                    
                    if (selectionCard) {
                        const cardAttachment = new AttachmentBuilder(selectionCard, { name: 'wallpaper_selection.png' });
                        await interaction.editReply({
                            content: `${EMOJIS.INFORMATION} Please select a wallpaper:`,
                            files: [cardAttachment],
                            components: [wallpaperSelect],
                            ephemeral: true
                        });
                    } else {
                        await interaction.editReply({
                            content: `${EMOJIS.INFORMATION} Please select a wallpaper:`,
                            components: [wallpaperSelect],
                            ephemeral: true
                        });
                    }
                } else if (interaction.customId === 'confirmServer') {
                    const serverData = client.tempData[interaction.user.id]?.serverData;
                    
                    if (!serverData) {
                        return interaction.reply({
                            content: `${EMOJIS.WARNING} No server data found. Please start over.`,
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
                            content: `${EMOJIS.CHECK} Server information saved successfully!`
                        });
                    } catch (error) {
                        console.error('Error saving server:', error);
                        await interaction.reply({
                            content: `${EMOJIS.WARNING} Error saving server information.`,
                            ephemeral: true
                        });
                    }
                } else if (interaction.customId === 'cancelServer') {
                    delete client.tempData[interaction.user.id];
                    await interaction.update({
                        components: [],
                        content: `${EMOJIS.WARNING} Setup cancelled.`
                    });
                }
            }
        } catch (error) {
            console.error('Error handling interaction:', error);
            
            const errorMessage = "An error occurred while processing your request.";
            
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
    }
};
