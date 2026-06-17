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
const Server = require('../Models/User');
const StatusBar = require('../Models/StatusBar');
const BlackList = require("../Models/BlackList");
// Helper to format emoji for Discord
const formatEmoji = (emoji) => {
    if (!emoji) return "";
    if (typeof emoji === 'string') return emoji;
    if (emoji.id) {
        return `<${emoji.animated ? "a" : ""}:emoji:${emoji.id}>`;
    }
    return "";
};

const EMOJIS_CONFIG = require("../settings/emojis");

// Custom emojis helper
const getEmoji = (name) => {
    const emoji = EMOJIS_CONFIG[name];
    return formatEmoji(emoji);
};

// Custom emojis mapped from central config
const EMOJIS = {
    BEDROCK: getEmoji('BEDROCK'),
    OFFLINE: getEmoji('OFFLINE'),
    ONLINE: getEmoji('ONLINE'),
    PLAYER: getEmoji('PLAYER'),
    INFORMATION: getEmoji('INFORMATION'),
    ACHIEVEMENT: getEmoji('ACHIEVEMENT'),
    CHECK: getEmoji('CHECK'),
    JAVA: getEmoji('JAVA'),
    WARNING: getEmoji('WARNING'),
    BLOCK: getEmoji('BLOCK'),
    SUCCESS: getEmoji('SUCCESS'),
    ERROR: getEmoji('ERROR'),
    SHIELD: getEmoji('SHIELD'),
    GEAR: getEmoji('GEAR'),
    SEARCH: getEmoji('SEARCH'),
    CLIPBOARD: getEmoji('CLIPBOARD'),
    EDIT: getEmoji('EDIT'),
    LINK: getEmoji('LINK'),
    SPARKLES: getEmoji('SPARKLES'),
    STAR: getEmoji('STAR'),
    PIN: getEmoji('PIN'),
    FIRE: getEmoji('FIRE'),
    ROCKET: getEmoji('ROCKET'),
    UP: getEmoji('UP'),
    DOWN: getEmoji('DOWN')
};

// Fast-loading wallpapers (optimized for speed)
const WALLPAPERS = [
    "https://i.ibb.co/TBVZycXV/2.png",
    "https://static1.srcdn.com/wordpress/wp-content/uploads/2022/05/Minecraft-Shader-Pine-Forest.jpg",
    "https://resourcepack.net/fl/images/2022/11/RedHat-Shaders-for-minecraft-5.jpg",
    "https://i.ibb.co/KpWg3FHw/687d56199156581-664cf6f062769.png",
    "https://i.ibb.co/qFrSvppV/1.png"
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
function getTranslatedMessage(client, guildId, messageKey) {
    if (!client?.t) return messageKey;
    return client.t(guildId, messageKey);
}

// Clean IP from prefixes
function cleanIP(ip) {
    if (!ip) return ip;
    // Removing these prefixes might cause issues with some servers that require them
    // Returning the original IP is safer for status checks
    return ip;
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
let createCanvas, loadImage, registerFont;
try {
  const canvas = require('canvas');
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
  registerFont = canvas.registerFont;
} catch (e) {
  console.log('⚠️ Canvas module not found, image generation features will be disabled.');
}

// Register fonts with proper error handling
const fontsDir = path.join(__dirname, '../src/fonts');
let fontsLoaded = false;

if (registerFont) {
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
      console.log('ℹ️ The bot will use default system fonts. Add d.ttf and f.ttf to bot/src/fonts/ for custom fonts. ');
    }
  } catch (fontError) {
    console.warn(`⚠️ Could not load custom Minecraft fonts: ${fontError.message}`);
  }
}

// Server status image generator - Redesigned with Aesthetics & Creativity
async function generateServerStatusImage(serverData, wallpaperUrl, interaction, isPreview = false, template = 'glass') {
    try {
        const canvasWidth = 800;
        const canvasHeight = 250;
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');

        // 1. Draw Background with Luxury Overlay
        try {
            const background = await loadImage(wallpaperUrl);
            ctx.drawImage(background, 0, 0, canvasWidth, canvasHeight);

            const overlay = ctx.createLinearGradient(0, 0, 0, canvasHeight);
            overlay.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
            overlay.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
            ctx.fillStyle = overlay;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        } catch (error) {
            ctx.fillStyle = '#0f111b';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        // 2. Fetch Server Data
        let serverStatus;
        if (isPreview) {
            serverStatus = {
                success: true,
                data: {
                    online: true,
                    hostname: serverData.javaIP || serverData.bedrockIP || 'play.example.com',
                    players: { online: 36481, max: 10000 },
                    version: '1.20.1',
					iconn: "https://api.mcstatus.io/v2/icon/play.cubecraft.net",
                    motd: { clean: ["§bCreative §fMinecraft Server", "§eJoin now for a unique experience!"] }
                }
            };
        } else if (serverData.serverType === 'java' && serverData.javaIP) {
            serverStatus = await checkServerStatus(serverData.javaIP, serverData.javaPort || 25565, 'java');
        } else if (serverData.serverType === 'bedrock' && serverData.bedrockIP) {
            serverStatus = await checkServerStatus(serverData.bedrockIP, serverData.bedrockPort || 19132, 'bedrock');
        }

        const isOnline = isPreview ? true : (serverStatus?.success && serverStatus?.data?.online);
        const serverName = (serverData.serverName || 'Minecraft Server').toUpperCase();
        const players = isPreview ? { online: 36478, max: 10000 } : (serverStatus?.data?.players || { online: 0, max: 0 });
        const version = isPreview ? '1.20.1' : (serverStatus?.data?.version || 'N/A');
        const displayIP = serverData.javaIP || serverData.bedrockIP || 'N/A';
        const displayPort = serverData.serverType === 'java' ? (serverData.javaPort || 25565) : (serverData.bedrockPort || 19132);

        // 3. Glass Panel + Accent Line
        const panelX = 24;
        const panelY = 24;
        const panelW = canvasWidth - 48;
        const panelH = canvasHeight - 48;

        ctx.fillStyle = 'rgba(16, 18, 32, 0.68)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 26);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        const accent = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
        accent.addColorStop(0, 'rgba(212, 175, 55, 0.9)');
        accent.addColorStop(0.45, 'rgba(212, 175, 55, 0.2)');
        accent.addColorStop(1, 'rgba(212, 175, 55, 0)');
        ctx.fillStyle = accent;
        ctx.fillRect(panelX + 18, panelY + 10, panelW - 36, 2);

        // 4. Server Icon with Glow
        const iconX = 52, iconY = 54, iconSize = 116;
        try {
            const serverIconUrl = isPreview 
                ? 'https://api.mcstatus.io/v2/icon/minecraft.net'
                : `https://api.mcstatus.io/v2/icon/${cleanIP(serverData.javaIP || serverData.bedrockIP)}:${serverData.javaPort || serverData.bedrockPort || 25565}`;
            
            const serverIcon = await loadImage(serverIconUrl);
            
            ctx.save();
            ctx.shadowBlur = 24;
            ctx.shadowColor = isOnline ? 'rgba(34, 224, 138, 0.55)' : 'rgba(255, 94, 94, 0.5)';
            ctx.beginPath();
            ctx.roundRect(iconX, iconY, iconSize, iconSize, 26);
            ctx.clip();
            ctx.drawImage(serverIcon, iconX, iconY, iconSize, iconSize);
            ctx.restore();
        } catch (error) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.beginPath();
            ctx.roundRect(iconX, iconY, iconSize, iconSize, 26);
            ctx.fill();
        }

        const infoX = iconX + iconSize + 38;
        const statusText = isOnline ? "ONLINE" : "OFFLINE";
        const statusColor = isOnline ? '#22E08A' : '#FF5E5E';

        // Status Badge
        ctx.font = 'bold 14px Arial';
        const badgePadding = 12;
        const badgeWidth = ctx.measureText(statusText).width + badgePadding * 2;
        const badgeX = canvasWidth - badgeWidth - 70;
        const badgeY = 58;
        ctx.fillStyle = 'rgba(10, 12, 22, 0.6)';
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, 26, 13);
        ctx.fill();
        ctx.strokeStyle = statusColor;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.fillStyle = statusColor;
        ctx.fillText(statusText, badgeX + badgePadding, badgeY + 18);

        // 5. Server Name & Status
        ctx.font = fontsLoaded ? 'bold 32px MinecraftBold' : 'bold 32px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.fillText(serverName, infoX, 88);
        ctx.shadowBlur = 0;

        // Removed Status Indicator Dot and Center Online Text

        // 6. Player Count & Version (Modern Layout)
        const infoY = 135; // Moved up from 155
        
        ctx.font = fontsLoaded ? '22px Minecraft' : '22px Arial';
        ctx.fillStyle = '#FFFFFF';
        
        const playerLabel = getTranslatedMessage(interaction?.client, interaction?.guild?.id, "PLAYERS") || "Players";
        const onlinePlayers = parseInt(players.online) || 0;
        const maxPlayers = parseInt(players.max) || 0;
        ctx.fillText(`${playerLabel}: ${onlinePlayers} / ${maxPlayers}`, infoX, infoY);
        
        ctx.font = fontsLoaded ? '18px Minecraft' : '18px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(`Version: ${version}`, infoX, infoY + 25);
        
        // IP Display in Image
        ctx.font = fontsLoaded ? '16px Minecraft' : '16px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillText(`IP: ${displayIP}${displayPort != 25565 && displayPort != 19132 ? ':' + displayPort : ''}`, infoX, infoY + 48);

        // 8. Progress Bar for Players
        if (isOnline && players.max > 0) {
            const barX = infoX, barY = infoY + 65, barW = 320, barH = 8;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, barH, 4);
            ctx.fill();
            
            const progress = Math.min(onlinePlayers / maxPlayers, 1);
            const gradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
            gradient.addColorStop(0, '#22E08A');
            gradient.addColorStop(1, '#0bbf6b');
            
            ctx.fillStyle = isOnline ? gradient : '#FF5E5E';
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW * progress, barH, 4);
            ctx.fill();

            // Progress Text
            const percentage = Math.round(progress * 100);
            ctx.font = 'bold 12px Arial';
            ctx.fillStyle = '#22E08A';
            ctx.fillText(`${percentage}%`, barX + barW + 10, barY + 8);
        }

        // 9. Player Skin Render (3D Bust)
        const skinX = canvasWidth - 180;
        const skinY = canvasHeight - 240;
        const skinSize = 200;
        
        try {
            // Using a placeholder or first player if available, else default to Steve/Alex
            const playerName = "Steve"; 
            const skinUrl = `https://render.crafty.gg/3d/bust/${playerName}`;
            const skinImage = await loadImage(skinUrl);
            
            // Draw the "Frame" for the skin
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.roundRect(skinX + 20, skinY + 40, 140, 160, 20);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.stroke();

            // To create the effect of hands coming out:
            // 1. Clip the bottom part (body inside frame)
            ctx.save();
            ctx.beginPath();
            ctx.rect(skinX, skinY + 40, 200, 160); // Frame area
            ctx.clip();
            ctx.drawImage(skinImage, skinX, skinY, skinSize, skinSize);
            ctx.restore();

            // 2. Draw the top part (head and hands) without clipping to "pop out"
            // We draw the same image again but only the parts we want to pop out
            // Since it's a bust, the hands/head will naturally look like they are popping out if the frame is positioned right
            ctx.drawImage(skinImage, skinX, skinY, skinSize, skinSize);
            
        } catch (e) {
            // Skip skin if failed
        }

        // 10. Footer & Watermark
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.textAlign = 'right';
        ctx.fillText(`PROMCBOT API • ${new Date().getFullYear()}`, canvasWidth - 40, canvasHeight - 25);
        
        if (isPreview) {
            ctx.font = 'bold 40px Arial';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.textAlign = 'center';
            ctx.fillText("PREVIEW MODE", canvasWidth / 2, canvasHeight / 2 + 15);
        }

        return canvas.toBuffer();
    } catch (error) {
        console.error('Error generating server status image:', error);
        const canvas = createCanvas(800, 250);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1a1a1d';
        ctx.fillRect(0, 0, 800, 250);
        ctx.font = '20px Arial';
        ctx.fillStyle = '#FF453A';
        ctx.textAlign = 'center';
        ctx.fillText("Failed to generate status image", 400, 125);
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
        
        const title = getTranslatedMessage(interaction?.client, interaction?.guild?.id, "SELECT_WALLPAPER") || "Select a Wallpaper";
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

const interactionCreateEvent = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        try {
            // Handle slash commands
            if (interaction.isChatInputCommand()) {
                if (!client.scommands || client.scommands.size === 0) {
                    console.error('client.scommands is not defined or empty');
                    return await interaction.reply({ 
                        content: `⚠️ Command system not initialized or no commands loaded. Please wait a moment and try again.`, 
                        ephemeral: true 
                    });
                }
                const command = client.scommands.get(interaction.commandName);
                
                if (!command) {
                    console.error(`No command matching ${interaction.commandName} was found.`);
                    return await interaction.reply({ 
                        content: `⚠️ Command \`${interaction.commandName}\` is not available or not yet registered.`, 
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
            } else if (interaction.isModalSubmit() && interaction.customId === 'apiModal') {
                await interaction.deferReply({ ephemeral: true });
                const apiToken = interaction.fields.getTextInputValue('apiToken') || null;
                const apiPortStr = interaction.fields.getTextInputValue('apiPort');
                const apiPort = apiPortStr ? parseInt(apiPortStr) : null;

                const serverData = client.tempData[interaction.user.id]?.serverData;
                const wallpaper = client.tempData[interaction.user.id]?.wallpaper;

                if (!serverData || !wallpaper) {
                    return interaction.editReply({
                        content: `${EMOJIS.WARNING} Missing data. Please start over.`,
                        ephemeral: true
                    });
                }

                // Add API info to serverData
                serverData.apiToken = apiToken;
                serverData.apiPort = apiPort;

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

                const serverIP = serverData.javaIP || serverData.bedrockIP;
                const serverPort = serverData.serverType === 'java' ? (serverData.javaPort || 25565) : (serverData.bedrockPort || 19132);
                const statusCheck = await checkServerStatus(serverIP, serverPort, serverData.serverType);
                const isOnlineActual = statusCheck.success && statusCheck.data?.online;

                const statusEmoji = isOnlineActual ? EMOJIS.ONLINE : EMOJIS.OFFLINE;
                const statusText = isOnlineActual ? "Online" : "Offline";

                await interaction.editReply({
                    content: `${EMOJIS.INFORMATION} Server status image ready!\n${statusEmoji} **Status:** ${statusText}\n${EMOJIS.LINK} **IP:** \`${serverIP}\`${apiToken ? '\n🔑 **API Token:** Saved' : ''}`,
                    files: [attachment],
                    components: [buttonRow],
                    ephemeral: true
                });
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
                    const serverData = client.tempData[interaction.user.id]?.serverData;
                    const wallpaper = client.tempData[interaction.user.id]?.wallpaper;
                    
                    if (!serverData || !wallpaper) {
                        return interaction.reply({
                            content: `${EMOJIS.WARNING} Missing server data. Please start over.`,
                            ephemeral: true
                        });
                    }

                    // Ask for API Token and Port
                    const apiModal = new ModalBuilder()
                        .setCustomId('apiModal')
                        .setTitle("API Configuration");

                    apiModal.addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('apiToken')
                                .setLabel("API Token (Optional)")
                                .setPlaceholder("Enter your API token if you have one")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('apiPort')
.setLabel("Lobby API Port (Default: 8080)")
	                                .setPlaceholder("Enter the second port for your lobby API")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(false)
                        )
                    );

                    await interaction.showModal(apiModal);
                    return;
                } else if (interaction.customId === 'chooseAnotherWallpaper') {
	
                    // Fix: Re-calculate isOnline or use a default if it's not in scope
                    // The best way is to fetch it from serverData or just rely on the image generation result
                    // Since we want to show it in the content, we can do a quick check
                    const serverIP = serverData.javaIP || serverData.bedrockIP;
                    const serverPort = serverData.serverType === 'java' ? (serverData.javaPort || 25565) : (serverData.bedrockPort || 19132);
                    const statusCheck = await checkServerStatus(serverIP, serverPort, serverData.serverType);
                    const isOnlineActual = statusCheck.success && statusCheck.data?.online;

                    const statusEmoji = isOnlineActual ? EMOJIS.ONLINE : EMOJIS.OFFLINE;
                    const statusText = isOnlineActual ? "Online" : "Offline";

                    await interaction.editReply({
                        content: `${EMOJIS.INFORMATION} Server status image ready!\n${statusEmoji} **Status:** ${statusText}\n${EMOJIS.LINK} **IP:** \`${serverIP}\``,
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
                    const wallpaper = client.tempData[interaction.user.id]?.wallpaper;
                    
                    if (!serverData) {
                        return interaction.reply({
                            content: `${EMOJIS.WARNING} No server data found. Please start over.`,
                            ephemeral: true
                        });
                    }
                    
                    try {
                        const existingServer = await Serverdb.findOne({ serverId: serverData.serverId });
                        
                        const finalData = {
                            ...serverData,
                            wallpaper: wallpaper || WALLPAPERS[0],
                            apiToken: serverData.apiToken,
                            apiPort: serverData.apiPort
                        };

                        if (existingServer) {
                            await Serverdb.updateOne({ serverId: serverData.serverId }, finalData);
                        } else {
                            await Serverdb.create(finalData);
                        }
                        
                        delete client.tempData[interaction.user.id];
                        
                        await interaction.update({
                            components: [],
                            content: `${EMOJIS.CHECK} Server information saved successfully!`,
                            files: []
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

module.exports = {
    ...interactionCreateEvent,
    generateServerStatusImage,
    checkServerStatus,
    cleanIP,
    WALLPAPERS
};
