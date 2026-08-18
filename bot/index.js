// bot/index.js - async initializer to ensure DB is connected before loading models
if (process.env.NODE_ENV !== 'production') {
  require('dotenv-flow').config();
}

const mongoose = require('mongoose');

const { Client, Partials, Collection, GatewayIntentBits } = require('discord.js');

async function initBot() {
  // Ensure mongoose strictQuery
  mongoose.set('strictQuery', true);

  // Initialize DB (if configured)
  const { MONGO_URL } = require('./settings/config');
  const { initDB, runMaintenance } = require('./utils/dbManager');

  if (MONGO_URL) {
    try {
      await initDB();
      console.log('✅ MongoDB Multi-URI System Initialized !!');
      console.log('🛠️ Starting initial database maintenance...');
      await runMaintenance();
    } catch (err) {
      console.warn('⚠️ Database initialization failed, continuing in degraded mode:', err && err.message);
    }
  } else {
    console.warn('⚠️ MONGO_URL not set. Starting in degraded (DB-disabled) mode.');
  }

  // Create Discord client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember, Partials.Reaction],
    failIfNotExists: false,
    allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
  });

  // Load models AFTER DB init so model queries don't run before connection
  const Langs = require('./Models/Langs');
  const Server = require('./Models/Server');
  const StatusBar = require('./Models/StatusBar');
  const PlayerHistory = require('./Models/PlayerHistory');
  const Message = require('./Models/Message');

  client.db = { Server, StatusBar, PlayerHistory };

  // Globals and helpers
  const fs = require('fs');
  client.emojis = require('./settings/emojis');
  client.translations = JSON.parse(fs.readFileSync('./bot/public/json/translations.json', 'utf8'));
  client.languages = new Collection();
  client.defaultLanguage = 'en';

  client.getLanguage = (guildId) => {
    if (!guildId) return client.defaultLanguage;
    const cached = client.languages.get(guildId);
    if (cached && client.translations?.[cached]) return cached;
    return client.defaultLanguage;
  };

  client.t = (guildId, key, variables = {}) => {
    const lang = client.getLanguage(guildId);
    const source = client.translations?.[lang] || {};
    const fallback = client.translations?.[client.defaultLanguage] || {};
    let text = source[key] ?? fallback[key] ?? key;
    if (typeof text === 'string') {
      const replaceEmojis = (str) => str.replace(/\${client\.emojis\.(\w+)}/g, (m, p1) => {
        const emoji = client.emojis[p1];
        if (!emoji) return '';
        if (typeof emoji === 'string') return emoji;
        if (emoji && emoji.id) return `<${emoji.animated ? 'a' : ''}:emoji:${emoji.id}>`;
        return '';
      });
      text = replaceEmojis(text);
      text = text.replace(/\${client\.(\w+)}/g, (m, p1) => client[p1] || m);
      text = text.replace(/\{(\w+)\}/g, (m, p1) => (Object.prototype.hasOwnProperty.call(variables, p1) ? String(variables[p1]) : m));
    }
    return text;
  };

  client.scommands = new Collection();
  client.mcommands = new Collection();
  client.cooldowns = new Collection();
  client.userSettings = new Collection();
  client.events = 0;

  // Load handlers
  const handlesFiles = ['event_handler','slash_handler','cmd_handler','membership_handler','blacklist_handler','bump_handler'];
  handlesFiles.forEach((file) => {
    try { require(`./handlers/${file}`)(client); } catch (e) { console.error(`❌ Error loading handler ${file}:`, e.message); }
  });

  // Ready maintenance hook
  client.once('ready', async () => {
    console.log(`🤖 ${client.user.tag} is ready. Running Ghost Servers Cleanup...`);
    try {
      const activeGuildIds = client.guilds.cache.map(g => g.id);
      const { runMaintenance } = require('./utils/dbManager');
      await runMaintenance(activeGuildIds);
      console.log('✅ Ghost Servers Cleanup completed.');
    } catch (err) {
      console.error('❌ Error during ready maintenance:', err.message);
    }
  });

  process.on('uncaughtException', (error) => console.error('❌ Unhandled Exception:', error));
  process.on('unhandledRejection', (reason, promise) => console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason));

  // Expose the real bot client to the dashboard for server discovery & checks
  global.__botClient = client;
  global.__dashClients = [client];

  return client;
}

module.exports = { start: initBot };
