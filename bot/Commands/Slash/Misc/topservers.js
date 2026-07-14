const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const Serverdb = require("../../../Models/Server");
const axios = require('axios');

// Utility to clean IP
function cleanIP(ip) {
    if (!ip) return '';
    return ip.replace(/^https?:\/\//, '').split('/')[0];
}

// Reuse the checkServerStatus function here since it's simple
async function checkServerStatus(ip, port, type) {
    if (!ip) return { success: false, data: { online: false } };
    const cleanIp = cleanIP(ip);
    const url = type === 'java' 
        ? `https://api.mcsrvstat.us/3/${cleanIp}:${port}`
        : `https://api.mcsrvstat.us/bedrock/3/${cleanIp}:${port}`;
    
    try {
        const response = await axios.get(url, { timeout: 3000 });
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, data: { online: false } };
    }
}

module.exports = {
  name: "topservers",
  description: "Displays the top servers using the bot",
  userPermissions: PermissionFlagsBits.SendMessages,
  botPermissions: PermissionFlagsBits.SendMessages,
  category: "Misc",
  type: ApplicationCommandType.ChatInput,
  
  run: async (client, interaction) => {
    // Defer the reply because API calls might take some time
    await interaction.deferReply();

    // Generate the leaderboard function
    const generateLeaderboard = async (sortBy) => {
      // 1. Get all guilds the bot is in
      const guilds = Array.from(client.guilds.cache.values());
      
      // 2. Get all Server configs from DB
      const dbServers = await Serverdb.find({});
      const dbServerMap = new Map();
      dbServers.forEach(s => dbServerMap.set(s.serverId, s));

      // 3. Map guild data with DB data
      let serverDataList = guilds.map(g => {
        const dbInfo = dbServerMap.get(g.id);
        return {
          id: g.id,
          name: g.name,
          memberCount: g.memberCount,
          interactions: dbInfo ? (dbInfo.interactionsCount || 0) : 0,
          dbInfo: dbInfo || null
        };
      });

      // 4. Sort
      if (sortBy === 'members') {
        serverDataList.sort((a, b) => b.memberCount - a.memberCount);
      } else if (sortBy === 'interactions') {
        serverDataList.sort((a, b) => b.interactions - a.interactions);
      }

      // 5. Take Top 10
      const top10 = serverDataList.slice(0, 10);

      // 6. Fetch Minecraft Player Count for top 10
      const embedFields = await Promise.all(top10.map(async (server, index) => {
        let mcPlayersText = "`N/A`";
        
        if (server.dbInfo) {
          const type = server.dbInfo.serverType === 'bedrock' ? 'bedrock' : 'java';
          const ip = type === 'java' ? server.dbInfo.javaIP : server.dbInfo.bedrockIP;
          const port = type === 'java' ? (server.dbInfo.javaPort || 25565) : (server.dbInfo.bedrockPort || 19132);
          
          if (ip) {
            const status = await checkServerStatus(ip, port, type);
            if (status.success && status.data && status.data.online && status.data.players) {
              mcPlayersText = `\`${status.data.players.online}/${status.data.players.max}\``;
            } else {
              mcPlayersText = "`Offline`";
            }
          } else {
             mcPlayersText = "`Not Setup`";
          }
        } else {
           mcPlayersText = "`Not Setup`";
        }

        return {
          name: `#${index + 1} | ${server.name}`,
          value: `👥 **Discord Members:** \`${server.memberCount}\`\n🎮 **MC Players:** ${mcPlayersText}\n🤖 **Interactions:** \`${server.interactions}\``,
          inline: false
        };
      }));

      // 7. Build Embed
      const titleText = sortBy === 'members' ? "Top Servers by Discord Members" : "Top Servers by Bot Interactions";
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31) // Discord dark theme color
        .setTitle(`🏆 ${titleText}`)
        .setDescription(`Showing the top ${top10.length} servers using this bot.`)
        .addFields(embedFields)
        .setTimestamp()
        .setFooter({ text: `Total Servers: ${guilds.length}`, iconURL: client.user.displayAvatarURL() });

      // 8. Build Dropdown
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('topservers_sort')
        .setPlaceholder('Sort leaderboard by...')
        .addOptions([
          {
            label: 'Discord Members',
            description: 'Sort by highest Discord member count',
            value: 'members',
            emoji: '👥'
          },
          {
            label: 'Bot Interactions',
            description: 'Sort by most bot usage/interactions',
            value: 'interactions',
            emoji: '🤖'
          }
        ]);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      return { embed, row };
    };

    // Initial load: sort by members
    const initialData = await generateLeaderboard('members');
    const message = await interaction.editReply({
      embeds: [initialData.embed],
      components: [initialData.row]
    });

    // Create a collector for the dropdown
    const collector = message.createMessageComponentCollector({
      filter: (i) => i.customId === 'topservers_sort' && i.user.id === interaction.user.id,
      time: 60000 * 5 // 5 minutes
    });

    collector.on('collect', async (i) => {
      // Defer the update to give time for API calls
      await i.deferUpdate();
      
      const sortBy = i.values[0];
      const newData = await generateLeaderboard(sortBy);
      
      await i.editReply({
        embeds: [newData.embed],
        components: [newData.row]
      });
    });

    collector.on('end', async () => {
      // Disable the dropdown when the collector ends
      initialData.row.components[0].setDisabled(true);
      await interaction.editReply({ components: [initialData.row] }).catch(() => null);
    });
  },
};
