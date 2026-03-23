const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const CONFIG = require('../settings/config');

module.exports.updateServerStatus = async (client, server, settings) => {
  const host = server.serverType === 'java' ? server.javaIP : server.bedrockIP;
  const port = server.serverType === 'java' ? server.javaPort : server.bedrockPort;
  
  // Defensive checks for CONFIG properties
  const EMBED_COLORS = CONFIG.EMBED_COLORS || { ONLINE: "#43b581", OFFLINE: "#f04747" };
  const EMOJIS = CONFIG.EMOJIS || { SERVER: client.emojis.SERVER, ONLINE: client.emojis.ONLINE, OFFLINE: client.emojis.OFFLINE, PLAYERS: client.emojis.MEMBERS, VERSION: client.emojis.EDIT };

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
    .setColor(data.online ? EMBED_COLORS.ONLINE : EMBED_COLORS.OFFLINE)
    .setTitle(`${EMOJIS.SERVER} ${server.serverName} - ${server.serverType.toUpperCase()}`)
    .setDescription(data.online ? `${EMOJIS.ONLINE} **ONLINE**` : `${EMOJIS.OFFLINE} **OFFLINE**`)
    .addFields(
      { name: `${client.emojis.PLUG} IP`, value: `\`${host}\``, inline: true },
      { name: `${EMOJIS.PLAYERS} Players`, value: `${playersOnline}/${playersMax}`, inline: true },
      { name: `${EMOJIS.VERSION} Version`, value: version, inline: true }
    )
    .setFooter({ text: `Last update • Updates every ${settings.updateInterval} min` })
    .setTimestamp();

  try {
    const channel = await client.channels.fetch(settings.statusChannelId);
    if (!channel) return;

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
