const { ActivityType, Collection, EmbedBuilder } = require("discord.js");
const axios = require('axios');
const Server = require("../Models/User");
const BlackList = require("../Models/BlackList");
const UpdateStatus = require("../Models/UpdateStatus");
const Serverdb = require("../Models/Server");

let toggle = true;

async function fetchServerStatus(apiUrl) {
  try {
    const response = await axios.get(apiUrl, { 
      timeout: 10000,
      headers: { 'User-Agent': 'MinecraftStatusBot/1.0' }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching server status:', error.message);
    return null;
  }
}

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}!`);
    
    try {
      client.user.setStatus("online");
    } catch (err) {
      console.error("Failed to set status:", err.message);
    }
    
    const activities = [
      { name: "ProMcBot | New update! 🚀", type: ActivityType.Playing },
      { name: "ProMcBot | Try new features! 🔥", type: ActivityType.Watching },
      { name: "ProMcBot | Compete now! ⚡", type: ActivityType.Competing },
      { name: "ProMcBot | Listening to your commands! 🎧", type: ActivityType.Listening }
    ];
    
    let activityIndex = 0;
    setInterval(() => {
      try {
        if (client.user) {
          client.user.setActivity(activities[activityIndex]);
          activityIndex = (activityIndex + 1) % activities.length;
        }
      } catch (err) {
        console.error("Error setting activity:", err.message);
      }
    }, 10000);

    // Initialize userSettings collection if not exists
    if (!client.userSettings) client.userSettings = new Collection();

    // تحميل البيانات الأولية
    try {
      const [servers, servers1, blacklists] = await Promise.all([
        Server.find().lean(),
        Serverdb.find().lean(),
        BlackList.find().lean()
      ]);
      
      servers.forEach((server) => client.userSettings.set(server.Id, server));
      servers1.forEach((server1) => client.userSettings.set(server1.Id, server1));
      blacklists.forEach((server2) => client.userSettings.set(server2.Id, server2));
      
      await Server.updateMany(
        { serverType: { $exists: false } },
        { $set: { serverType: 'java' } }
      );
    } catch (err) {
      console.error("Error loading initial data:", err.message);
    }

    // تحديث حالة السيرفرات بشكل دوري
    setInterval(async () => {
      try {
        const updatingGuilds = await UpdateStatus.find({ isUpdating: true });

        for (const updateStatus of updatingGuilds) {
          try {
            const guild = client.guilds.cache.get(updateStatus.guildId);
            if (!guild) continue;

            const category = guild.channels.cache.get(updateStatus.categoryId);
            const statusChannel = guild.channels.cache.get(updateStatus.statusChannelId);
            const playerCountChannel = updateStatus.playerCountChannelId ? guild.channels.cache.get(updateStatus.playerCountChannelId) : null;

            if (category && statusChannel && (playerCountChannel || updateStatus.updateType === 'text')) {
              const serverInfo = await Server.findOne({ serverId: updateStatus.guildId });

              if (serverInfo && serverInfo.serverType) {
                let categoryName, apiUrl;

                if (serverInfo.serverType === 'custom') {
                  if (toggle) {
                    apiUrl = `https://api.mcsrvstat.us/3/${serverInfo.javaIP}:${serverInfo.javaPort}`;
                    categoryName = `${serverInfo.javaIP}`;
                  } else {
                    apiUrl = `https://api.mcsrvstat.us/3/${serverInfo.bedrockIP}:${serverInfo.bedrockPort}`;
                    categoryName = `${serverInfo.bedrockIP}`;
                  }
                  toggle = !toggle;
                } else if (serverInfo.serverType === 'java') {
                  apiUrl = `https://api.mcsrvstat.us/3/${serverInfo.javaIP}:${serverInfo.javaPort}`;
                  categoryName = `${serverInfo.javaIP}`;
                } else if (serverInfo.serverType === 'bedrock') {
                  apiUrl = `https://api.mcsrvstat.us/3/${serverInfo.bedrockIP}:${serverInfo.bedrockPort}`;
                  categoryName = `${serverInfo.bedrockIP}`;
                } else {
                  continue;
                }

                const data = await fetchServerStatus(apiUrl);
                if (!data) continue;

                const isOnline = data.online;
                const playerCount = data.players ? data.players.online : '--';
                const playerCountMax = data.players ? data.players.max : '--';

                const statusName = `Status: ${isOnline ? 'Online' : 'Offline'}`;
                const playerCountName = `Players: ${isOnline ? playerCount : '--'} / ${isOnline ? playerCountMax : '--'}`;

                if (category && category.name !== categoryName) await category.edit({ name: categoryName }).catch(() => {});
                if (statusChannel) await statusChannel.edit({ name: statusName }).catch(() => {});
                if (playerCountChannel) await playerCountChannel.edit({ name: playerCountName }).catch(() => {});
                
                if (updateStatus.updateType === 'text' && updateStatus.messageId) {
                  const statusChannelMessage = await statusChannel.messages.fetch(updateStatus.messageId).catch(() => null);
                  if (statusChannelMessage) {
                    await statusChannelMessage.edit(`**${statusName}**\n**${playerCountName}**`).catch(() => {});
                  }
                }
              }
            }
          } catch (innerErr) {
            console.error(`Error updating guild ${updateStatus.guildId}:`, innerErr.message);
          }
        }
      } catch (err) {
        console.error("Error in status update interval:", err.message);
      }
    }, 60 * 1000);
  }
};
