const { ActivityType, Collection, ChannelType, PermissionsBitField, EmbedBuilder } = require("discord.js");
const Jimp = require('jimp');
const client = require("../index");
//const client1 = require("../index");
const express = require('express');
const axios = require('axios');
const Server = require("../Models/User");
const BlackList = require("../Models/BlackList");
const { Webhook } = require('@top-gg/sdk');

const moment = require("moment");
const voucher_codes = require("voucher-code-generator");
const bodyParser = require('body-parser');
const schema = require("../Models/Code");
const UpdateStatus = require("../Models/UpdateStatus");
const Serverdb = require("../Models/Server");
const router = express.Router();


client.userSettings = new Collection();

const TOPGG_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJib3QiOiJ0cnVlIiwiaWQiOiIxMjIwMDA1MjYwODU3MzExMjk0IiwiaWF0IjoiMTc0ODMzOTE4NiJ9.IWIrXCofkGmFuhIYbCAPAWBULkjBbmBtUe8S4-qXKjk';
const GUILD_ID = '1226151054178127872';
const CHANNEL_ID = '1273517257540112456';

const THANK_YOU_MESSAGES = [
  "شكرًا جزيلاً لتصويتك! 🌟",
  "نقدر تصويتك جدًا! 😊",
  "أنت الأفضل! شكراً لتصويتك. 🎉",
  "تصويتك يعني لنا الكثير! 🙏",
  "شكرًا لدعمك الرائع! ❤️"
];

let toggle = true;

async function fetchServerStatus(apiUrl) {
  try {
    const response = await axios.get(apiUrl, { timeout: 10000 });
    return response.data;
  } catch (error) {
    console.error('Error fetching server status:', error);
    return null;
  }
}

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setStatus("online");
    
    const activities = [
      { name: "ProMcBot | New update! 🚀", type: ActivityType.Playing },
      { name: "ProMcBot | Try new features! 🔥", type: ActivityType.Watching },
      { name: "ProMcBot | Compete now! ⚡", type: ActivityType.Competing },
      { name: "ProMcBot | Listening to your commands! 🎧", type: ActivityType.Listening }
    ];
    
    let activityIndex = 0;
    setInterval(() => {
      client.user.setActivity(activities[activityIndex]);
      activityIndex = (activityIndex + 1) % activities.length;
    }, 10000);

    // تحميل البيانات الأولية
    try {
      const [servers, servers1, blacklists] = await Promise.all([
        Server.find(),
        Serverdb.find(),
        BlackList.find()
      ]);
      
      servers.forEach((server) => client.userSettings.set(server.Id, server));
      servers1.forEach((server1) => client.userSettings.set(server1.Id, server1));
      blacklists.forEach((server2) => client.userSettings.set(server2.Id, server2));
      
      await Server.updateMany(
        { serverType: { $exists: false } },
        { $set: { serverType: 'java' } }
      );
    } catch (err) {
      console.error("Error loading initial data:", err);
    }

    // تحديث حالة السيرفرات بشكل دوري
    setInterval(async () => {
      try {
        const updatingGuilds = await UpdateStatus.find({ isUpdating: true });

        for (const updateStatus of updatingGuilds) {
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
        }
      } catch (err) {
        console.error("Error in status update interval:", err);
      }
    }, 60 * 1000);
  }
};
const webhook = new Webhook(TOPGG_TOKEN);

router.get('/dblwebhook', (req, res) => {
  res.send('Webhook is working!');
});

router.post('/dblwebhook', bodyParser.json(), webhook.middleware(), async (req, res) => {
  console.log('Received a vote request:', req.body);

  if (!req.vote) {
    console.error('No vote data found in request body');
    return res.status(400).send('No vote data');
  }

  const { user } = req.vote;

  try {
    console.log('Fetching guild...');
    const guild = await client.guilds.fetch(GUILD_ID);
    console.log('Guild fetched:', guild.name);

    console.log('Fetching channel...');
    const channel = guild.channels.cache.get(CHANNEL_ID);
    if (!channel) {
      throw new Error('Channel not found');
    }
    console.log('Channel fetched:', channel.name);

    console.log('Fetching member...');
    const member = await guild.members.fetch(user);
    if (!member || !member.user) {
      throw new Error('Member not found');
    }
    console.log('Member fetched:', member.user.tag);

    const message = 'Thank you for voting!';
    let code;
    const plan = "voter";
    const codes = [];
    let time;

    if (plan === "voter") time = Date.now() + 129600000;

    console.log('Generating codes...');
    for (let i = 0; i < 1; i++) {
      const codeMemberShip = voucher_codes.generate({
        pattern: "####-#####-###-####",
      });
      code = codeMemberShip.toString().toUpperCase();
      const find = await schema.findOne({ code: code });
      if (!find) {
        await schema.create({ code: code, plan: plan, expiresAt: time });
        codes.push(`${code}`);
      }
    }

    console.log('Codes generated:', codes);

    const dssd = new EmbedBuilder()
      .setColor('#ee3c37')
      .setTitle('Generated Membership Code By Voter System')
      .setDescription(`\`\`\`${code}\`\`\``)
      .addFields([{ name: 'Expires At', value: `<t:${Math.floor(time / 1000)}:F>` }])
      .setFooter({ text: `To redeem, use your bot's redeem command ( !claim ${code} ) on your server` });

   ////// await member.send({ content: message, embeds: [dssd] }).catch(console.error);

    const onecodemshfr = code.slice(0, 3);
    const maskedCode = "x".repeat(code.length - 1) + "-" + "x".repeat(code.length - 5) + "-" + "x".repeat(code.length - 3) + "-" + "x".repeat(code.length - 2);
    const twocodemshfr = code.slice(-2);

    const embed = new EmbedBuilder()
      .setColor('#ee3c37')
      .setTitle('شكراً لتصويتك!')
      .setDescription(`**${member.user.username} شكرًا جزيلاً لتصويتك لنا على top.gg! 🎉\n تم منحك الكود الخاص بك لتفعيل عضوية التميز بخادمك الخاص**`)
      .addFields({ name: 'Plan', value: "Voter" })
      .addFields({ name: 'Code', value: `${onecodemshfr}||${maskedCode}||${twocodemshfr}` })
      .setTimestamp()
      .setFooter({ text: 'تصويتك يعني لنا الكثير!', iconURL: 'https://i.ibb.co/7GCzzTZ/7df0b585344a4e68c64e52c419129aa4.webp' });

    await channel.send({ content: `${member}`, embeds: [embed] });

  } catch (error) {
    console.error('Error handling vote:', error);
  }
});

/*
const api = new Toggg.Api(`${TOPGG_TOKEN}`);

api.postStats({

  serverCount: client.guilds.cache.size

});*/

const { AutoPoster } = require('topgg-autoposter');

const ap = AutoPoster('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJib3QiOiJ0cnVlIiwiaWQiOiIxMjIwMDA1MjYwODU3MzExMjk0IiwiaWF0IjoiMTc0ODMzODc3OCJ9.u1M5nkVIOj068eNuFwUyWbgTUFeY7_ftPJhRwRlk1iI', client);

// أضف في نهاية الملف = app; // إذا كان لديك متغير amodule.exports.client= router; // البوت الأول

/*app.listen(6365, () => {
  console.log('Server is running on port 6365');
});*/

module.exports.router = router;