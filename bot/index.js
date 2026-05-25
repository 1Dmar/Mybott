// bot/index.js - Fixed version for Railway deployment
// Load environment variables only in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const { Client, Partials, Collection, GatewayIntentBits } = require("discord.js");
const mongoose = require("mongoose");
const Langs = require("./Models/Langs");
const { scheduleCronJobs } = require('./utils/cronManager');
const Server = require('./Models/Server');
const StatusBar = require('./Models/StatusBar');

// Get config (uses environment variables)
const { MONGO_URL } = require("./settings/config");

if (!MONGO_URL) {
  console.error("❌ ERROR: MONGO_URL environment variable is not set!");
}

const Message = require('./Models/Message');

async function cleanupDatabase() {
  try {
    // 1. Remove duplicate guild IDs in Langs
    const duplicates = await Langs.aggregate([
      { $group: { _id: "$guildIds", count: { $sum: 1 }, ids: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } }
    ]);

    for (const duplicate of duplicates) {
      const [firstId, ...duplicateIds] = duplicate.ids;
      await Langs.deleteMany({ _id: { $in: duplicateIds } });
    }
    console.log('✅ Duplicate entries removed.');

    // 2. Auto-cleanup old ticket messages (older than 30 days) to save MongoDB space
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const result = await Message.deleteMany({ timestamp: { $lt: thirtyDaysAgo } });
    if (result.deletedCount > 0) {
      console.log(`✅ Cleaned up ${result.deletedCount} old ticket messages to save space.`);
    }
  } catch (error) {
    console.error('Error during database cleanup:', error);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember,
    Partials.Reaction,
  ],
  failIfNotExists: false,
  allowedMentions: {
    parse: [],
    users: [],
    roles: [],
    repliedUser: false,
  },
});

// Database setup
client.db = { Server, StatusBar };
mongoose.set("strictQuery", true);

// Connect to MongoDB using Multi-URI Manager
const { initDB, runMaintenance } = require("./utils/dbManager");
if (MONGO_URL) {
  initDB()
    .then(async () => {
      console.log(`✅ MongoDB Multi-URI System Initialized !!`);
      
      // Run initial migration and optimization
      console.log(`🛠️ Starting initial database maintenance...`);
      await runMaintenance();
      
      await cleanupDatabase();
    })
    .catch(error => {
      console.error('❌ Error initializing Database Manager:', error.message);
    });
} else {
  console.warn("⚠️ MongoDB URL not provided, database features will be disabled.");
}

// Global variables
const fs = require('fs');
client.emojis = require("./settings/emojis");
client.translations = JSON.parse(fs.readFileSync('./bot/public/json/translations.json', 'utf8'));
client.languages = new Collection(); // Cache for server languages

// Translation function
client.t = (guildId, key) => {
  const lang = client.languages.get(guildId) || 'en';
  let text = client.translations[lang] ? (client.translations[lang][key] || key) : (client.translations['en'][key] || key);
  
  if (typeof text === 'string') {
    const replaceEmojis = (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/\${client\.emojis\.(\w+)}/g, (match, p1) => {
        const emoji = client.emojis[p1];
        if (!emoji || (typeof emoji === 'string' && emoji === "")) return "";
        if (typeof emoji === 'string') return emoji;
        if (emoji && emoji.id) {
          return `<${emoji.animated ? 'a' : ''}:emoji:${emoji.id}>`;
        }
        return "";
      });
    };
    text = replaceEmojis(text);
    text = text.replace(/\${client\.(\w+)}/g, (match, p1) => client[p1] || match);
  }
  return text;
};

client.scommands = new Collection();
client.mcommands = new Collection();
client.cooldowns = new Collection();
client.userSettings = new Collection();
client.events = 0;

// Load handlers
const handlesFiles = [
  "event_handler",
  "slash_handler",
  "cmd_handler",
  "membership_handler",
  "blacklist_handler",
  "bump_handler"
];

handlesFiles.forEach((file) => {
  try {
    require(`./handlers/${file}`)(client);
  } catch (error) {
    console.error(`❌ Error loading handler ${file}:`, error.message);
  }
});

// Smart Cleanup when bot is ready
client.once('ready', async () => {
  console.log(`🤖 ${client.user.tag} is ready. Running Ghost Servers Cleanup...`);
  try {
    const activeGuildIds = client.guilds.cache.map(guild => guild.id);
    const { runMaintenance } = require("./utils/dbManager");
    await runMaintenance(activeGuildIds);
    console.log(`✅ Ghost Servers Cleanup completed.`);
  } catch (error) {
    console.error(`❌ Error during ready maintenance:`, error.message);
  }
});

// WebSocket error handling
client.ws.on('error', (error) => {
  console.error('⚠️ WebSocket error:', error);
});

client.ws.on('close', (code, reason) => {
  console.error(`⚠️ WebSocket closed with code ${code}: ${reason}`);
});

// Process error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Unhandled Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = client;
