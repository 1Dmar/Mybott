// Bot index.js - Fixed version for Railway deployment
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
const { MONGO_URL, TOKEN } = require("./settings/config");

// Validate required environment variables
if (!TOKEN) {
  console.error("${client.emojis.ERROR} ERROR: BOT1_1_TOKEN environment variable is not set!");
  console.error("${client.emojis.INFO} Please set the BOT1_1_TOKEN in your Railway environment variables.");
  process.exit(1);
}

if (!MONGO_URL) {
  console.error("${client.emojis.ERROR} ERROR: MONGO_URL environment variable is not set!");
  console.error("${client.emojis.INFO} Please set the MONGO_URL in your Railway environment variables.");
}

async function removeDuplicateGuildIds() {
  try {
    const duplicates = await Langs.aggregate([
      { $group: { _id: "$guildIds", count: { $sum: 1 }, ids: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } }
    ]);

    for (const duplicate of duplicates) {
      const [firstId, ...duplicateIds] = duplicate.ids;
      await Langs.deleteMany({ _id: { $in: duplicateIds } });
    }
  } catch (error) {
    console.error('Error removing duplicate guild IDs:', error);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
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

// Database setup
client.db = { Server, StatusBar };
mongoose.set("strictQuery", true);

// Connect to MongoDB
if (MONGO_URL) {
  mongoose
    .connect(MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(async () => {
      console.log(`${client.emojis.SUCCESS} MongoDB Connected !!`);
      await removeDuplicateGuildIds();
      console.log('${client.emojis.SUCCESS} Duplicate entries removed.');
    })
    .catch(error => {
      console.error('${client.emojis.ERROR} Error connecting to MongoDB:', error.message);
    });
} else {
  console.warn("${client.emojis.WARNING}️ MongoDB URL not provided, database features will be disabled.");
}

// Global variables
const fs = require('fs');
client.emojis = require("./settings/emojis");
client.translations = JSON.parse(fs.readFileSync('./bot/public/json/translations.json', 'utf8'));
client.languages = new Collection(); // Cache for server languages

// Translation function
client.t = (guildId, key) => {
  const lang = client.languages.get(guildId) || 'en';
  return client.translations[lang] ? (client.translations[lang][key] || key) : (client.translations['en'][key] || key);
};

client.scommands = new Collection();
client.mcommands = new Collection();
client.cooldowns = new Collection();
client.userSettings = new Collection();
client.events = 0;

// Bot ready event
client.once('ready', async () => {
  console.log(`${client.emojis.SUCCESS} Logged in as ${client.user.tag}!`);
  
  // Schedule cron jobs
  try {
    await scheduleCronJobs(client);
  } catch (error) {
    console.error('Error scheduling cron jobs:', error);
  }

  // Send startup notification (without exposing the full token)
  try {
    const webhookUrl = process.env.STARTUP_WEBHOOK_URL;
    if (webhookUrl) {
      const { WebhookClient } = require('discord.js');
      const webhookClient = new WebhookClient({ url: webhookUrl });
      webhookClient.send({
        content: `${client.emojis.ROBOT} **Bot Started Successfully!**\n**Bot Name:** ${client.user.tag}\n**Bot ID:** ${client.user.id}\n**Time:** ${new Date().toISOString()}`
      }).catch(() => {});
    }
  } catch (error) {
    console.log('Webhook notification failed (non-critical):', error.message);
  }
});

// Error handling with discord.js-anticrash
try {
  const { errorHandling } = require("discord.js-anticrash");
  const configg = {
    webhookUrl: process.env.ERROR_WEBHOOK_URL || "",
    embedColor: "#04fc7c",
    embedTitle: "Error",
    webhookUsername: "Error Bot",
  };
  
  if (configg.webhookUrl) {
    errorHandling(client, configg);
  } else {
    console.log('${client.emojis.WARNING}️ Error webhook not configured, anticrash will log to console only.');
  }
} catch (error) {
  console.log('discord.js-anticrash not available:', error.message);
}

// WebSocket error handling
client.ws.on('error', (error) => {
  console.error('${client.emojis.WARNING}️ WebSocket error:', error);
});

client.ws.on('close', (code, reason) => {
  console.error(`${client.emojis.WARNING}️ WebSocket closed with code ${code}:`, reason);
  // Don't auto-reconnect here - let the built-in reconnection handle it
});

// Process error handling
process.on('uncaughtException', (error) => {
  console.error('${client.emojis.ERROR} Unhandled Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('${client.emojis.ERROR} Unhandled Rejection at:', promise, 'reason:', reason);
});

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
    console.error(`${client.emojis.ERROR} Error loading handler ${file}:`, error.message);
  }
});

// Login the bot
console.log('${client.emojis.LOADING} Attempting to login bot...');
client.login(TOKEN).catch(err => {
  console.error('${client.emojis.ERROR} Bot login failed:', err.message);
  if (err.message.includes('token')) {
    console.error('${client.emojis.INFO} Please check that BOT1_1_TOKEN is set correctly in Railway environment variables.');
  }
});

module.exports = client;
