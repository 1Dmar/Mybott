const {
  CommandInteraction,
  ApplicationCommandType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
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

    // Cache to prevent re-fetching DB every time page changes
    let allServerData = null;

    // Generate the leaderboard function
    const generateLeaderboard = async (sortBy, page) => {
      if (!allServerData) {
          // 1. Get all guilds the bot is in
          const guilds = Array.from(client.guilds.cache.values());
          
          // 2. Get all Server configs from DB
          const dbServers = await Serverdb.find({});
          const dbServerMap = new Map();
          dbServers.forEach(s => dbServerMap.set(s.serverId, s));

          // 3. Map guild data with DB data
          allServerData = guilds.map(g => {
            const dbInfo = dbServerMap.get(g.id);
            return {
              id: g.id,
              name: g.name,
              memberCount: g.memberCount,
              interactions: dbInfo ? (dbInfo.interactionsCount || 0) : 0,
              dbInfo: dbInfo || null
            };
          });
      }

      // 4. Sort
      if (sortBy === 'members') {
        allServerData.sort((a, b) => b.memberCount - a.memberCount);
      } else if (sortBy === 'interactions') {
        allServerData.sort((a, b) => b.interactions - a.interactions);
      }

      // 5. Pagination Logic
      const itemsPerPage = 10;
      const maxPages = Math.ceil(allServerData.length / itemsPerPage) || 1;
      if (page > maxPages) page = maxPages;
      if (page < 1) page = 1;
      
      const startIndex = (page - 1) * itemsPerPage;
      const currentPageData = allServerData.slice(startIndex, startIndex + itemsPerPage);

      // 6. Fetch Minecraft Player Count for current page
      const embedFields = await Promise.all(currentPageData.map(async (server, index) => {
        let mcPlayersText = "`N/A`";
        const realIndex = startIndex + index + 1;
        
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
          name: `#${realIndex} | ${server.name}`,
          value: `👥 **Discord Members:** \`${server.memberCount}\`\n🎮 **MC Players:** ${mcPlayersText}\n🤖 **Interactions:** \`${server.interactions}\``,
          inline: false
        };
      }));

      // 7. Build Embed
      const titleText = sortBy === 'members' ? "Top Servers by Discord Members" : "Top Servers by Bot Interactions";
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle(`🏆 ${titleText}`)
        .setDescription(`Showing page ${page}/${maxPages} of all servers using this bot.`)
        .addFields(embedFields)
        .setTimestamp()
        .setFooter({ text: `Total Servers: ${allServerData.length} | Page ${page}/${maxPages}`, iconURL: client.user.displayAvatarURL() });

      // 8. Build Sort Dropdown
      const sortMenu = new StringSelectMenuBuilder()
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

      // 9. Build Invite Dropdown (only for servers on this page)
      const inviteMenu = new StringSelectMenuBuilder()
        .setCustomId('topservers_invite')
        .setPlaceholder('Get invite link for a server...')
        .addOptions(currentPageData.map((server, index) => ({
            label: `${startIndex + index + 1}. ${server.name.substring(0, 50)}`,
            description: 'Click to get a 1-use invite link for this server',
            value: server.id,
            emoji: '🔗'
        })));

      const sortRow = new ActionRowBuilder().addComponents(sortMenu);
      const inviteRow = new ActionRowBuilder().addComponents(inviteMenu);
      
      // 10. Build Buttons
      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('topservers_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 1),
        new ButtonBuilder()
            .setCustomId('topservers_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === maxPages)
      );

      return { embed, components: [sortRow, inviteRow, btnRow], maxPages };
    };

    // Initial load: sort by members, page 1
    let currentSort = 'members';
    let currentPage = 1;
    
    const initialData = await generateLeaderboard(currentSort, currentPage);
    const message = await interaction.editReply({
      embeds: [initialData.embed],
      components: initialData.components
    });

    // Create a collector
    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 60000 * 5 // 5 minutes
    });

    collector.on('collect', async (i) => {
      
      if (i.customId === 'topservers_invite') {
          await i.deferReply({ ephemeral: true });
          const guildId = i.values[0];
          const targetGuild = client.guilds.cache.get(guildId);
          
          if (!targetGuild) {
              return i.editReply({ content: "❌ I couldn't find this server. I might have been kicked." });
          }

          // Try to create invite
          let inviteUrl = null;
          try {
              // Find first channel bot can create invite in
              const channels = Array.from(targetGuild.channels.cache.values());
              const textChannel = channels.find(c => 
                  c.isTextBased() && 
                  c.permissionsFor(targetGuild.members.me).has('CreateInstantInvite')
              );
              
              if (textChannel) {
                  const invite = await textChannel.createInvite({
                      maxAge: 86400, // 24 hours
                      maxUses: 1,
                      unique: true,
                      reason: `Requested by ${i.user.tag} via topservers command`
                  });
                  inviteUrl = invite.url;
              }
          } catch (e) {
              console.error("Invite creation failed:", e);
          }

          if (inviteUrl) {
              return i.editReply({ content: `✅ **Here is your 1-use invite link to ${targetGuild.name}:**\n${inviteUrl}` });
          } else {
              return i.editReply({ content: `❌ **I don't have permissions to create invites in ${targetGuild.name}!**` });
          }
      }

      // For other interactions (sort, pagination), defer update and edit main message
      await i.deferUpdate();
      
      if (i.customId === 'topservers_sort') {
          currentSort = i.values[0];
          currentPage = 1; // reset page on sort
      } else if (i.customId === 'topservers_prev') {
          currentPage--;
      } else if (i.customId === 'topservers_next') {
          currentPage++;
      }
      
      const newData = await generateLeaderboard(currentSort, currentPage);
      
      await i.editReply({
        embeds: [newData.embed],
        components: newData.components
      });
    });

    collector.on('end', async () => {
      // Disable everything
      const disabledComponents = initialData.components.map(row => {
          const newRow = new ActionRowBuilder();
          row.components.forEach(c => {
              newRow.addComponents(ButtonBuilder.from(c).setDisabled(true)); // Works generically to disable
          });
          return newRow;
      });
      // Just remove components or edit properly
      await interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};
