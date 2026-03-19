const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const CONFIG = require('../config');

module.exports.updateServerStatus = async (client, server, settings) => {
  const host = server.serverType === 'java' ? server.javaIP : server.bedrockIP;
  const port = server.serverType === 'java' ? server.javaPort : server.bedrockPort;
  
  // Fixed API endpoints with User-Agent header
  const apiUrl = server.serverType === 'java' 
    ? `https://api.mcsrvstat.us/3/${encodeURIComponent(host)}${port ? `:${port}` : ''}`
    : `https://api.mcsrvstat.us/bedrock/3/${encodeURIComponent(host)}${port ? `:${port}` : ''}`;

  let data;
  try {
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'MinecraftStatusBot/1.0 (Discord Bot)'
      }
    });
    data = response.data;
  } catch (error) {
    console.error(`API Error [${server.serverName}]:`, error.message);
    data = { online: false };
  }
  
  // Handle new API response structure
  const playersOnline = data.online ? (data.players?.online || 0) : 0;
  const playersMax = data.online ? (data.players?.max || 0) : 0;
  const version = data.online 
    ? (server.serverType === 'java' ? data.version : data.version?.name) 
    : 'N/A';

  const embed = new EmbedBuilder()
    .setColor(data.online ? CONFIG.EMBED_COLORS.ONLINE : CONFIG.EMBED_COLORS.OFFLINE)
    .setTitle(`${CONFIG.EMOJIS.SERVER} ${server.serverName} - ${server.serverType.toUpperCase()}`)
    .setDescription(data.online ? `${CONFIG.EMOJIS.ONLINE} **ONLINE**` : `${CONFIG.EMOJIS.OFFLINE} **OFFLINE**`)
    .addFields(
      { name: '🔌 IP', value: `\`${host}\``, inline: true },
      { name: `${CONFIG.EMOJIS.PLAYERS} Players`, value: `${playersOnline}/${playersMax}`, inline: true },
      { name: `${CONFIG.EMOJIS.VERSION} Version`, value: version, inline: true }
    )
    .setFooter({ text: `Last update • Updates every ${settings.updateInterval} min` })
    .setTimestamp();

  try {
    const channel = await client.channels.fetch(settings.statusChannelId);
    if (settings.statusMessageId) {
      try {
        const message = await channel.messages.fetch(settings.statusMessageId);
        await message.edit({ embeds: [embed] });
      } catch {
        const newMessage = await channel.send({ embeds: [embed] });
        settings.statusMessageId = newMessage.id;
        await settings.save();
      }
    } else {
      const newMessage = await channel.send({ embeds: [embed] });
      settings.statusMessageId = newMessage.id;
      await settings.save();
    }

    settings.lastUpdated = Date.now();
    await settings.save();
  } catch (error) {
    console.error(`Channel Error [${server.serverName}]:`, error.message);
  }
};