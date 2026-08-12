// server.js - Fixed version
// Load environment variables (Railway provides these directly, dotenv is for local dev)
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv-flow').config();
    console.log('✅ Environment variables loaded via dotenv-flow for development.');
  } catch (e) {
    console.warn('⚠️ dotenv-flow failed to load environment variables:', e.message);
  }
}

const express = require('express');
const mainApp = express();

// Trust proxy for Railway
mainApp.set('trust proxy', 1);

// Health check endpoint (required for Railway and Docker HEALTHCHECK)
mainApp.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    bot: proMcBotClient ? (proMcBotClient.isReady ? proMcBotClient.isReady() : false) : false
  });
});

// Centralized Bot Login Management
const loginBot = async (clientInstance, token, name) => {
  if (!clientInstance || !token) {
    console.log(`⚠️ Skipping ${name} login: Missing client instance or token.`);
    return false;
  }
  // Check if client is already logged in (client.user will be populated)
  if (clientInstance.user) {
    console.log(`ℹ️ ${name} is already logged in as ${clientInstance.user.tag}.`);
    return true;
  }
  try {
    console.log(`⏳ Attempting to log in ${name}...`);
    await clientInstance.login(token);
    console.log(`✅ ${name} logged in successfully as ${clientInstance.user.tag}!`);
    return true;
  } catch (err) {
    console.error(`❌ ${name} Login Error:`, err.message);
    return false;
  }
};

// Bot Tokens from Environment Variables
// Main bot MUST use BOT1_1_TOKEN as requested
const MAIN_BOT_TOKEN = process.env.BOT1_1_TOKEN;
const MODDY_BOT_TOKEN = process.env.BOT1_TOKEN;

// --- Bot Initialization --- 
// Import the main bot client (ProMcBot) from bot/index.js
let proMcBotClient = null;
const PORT = process.env.PORT || 8080;

// Import the dashboard module, which contains Moddy Bot client
let dashboardModule = null;
let moddyBotClient = null;
// If BOT_ONLY=true, skip loading the dashboard and API to run bot-only mode.
if (process.env.BOT_ONLY !== 'true') {
  try {
    dashboardModule = require('./dash/index');
    if (dashboardModule && dashboardModule.app) {
      // Use the environment variable for CALLBACK_URL or default to relative path
      // process.env.CALLBACK_URL = process.env.CALLBACK_URL || "/auth/discord/callback";
      mainApp.use('/', dashboardModule.app);
      console.log(`✅ Dashboard module loaded. Callback URL set to: ${process.env.CALLBACK_URL}`);
    }
  } catch (err) {
    console.log('⚠️ Dashboard module not loaded or client1 not found:', err.message);
  }
} else {
  console.log('ℹ️ BOT_ONLY=true — skipping dashboard and HTTP routes (bot-only mode).');
}

// Inject bot API
if (process.env.BOT_ONLY !== 'true') {
  try {
    const botApi = require('./bot/api/index');
    mainApp.use('/bot', express.json()); // Add json parsing for /bot
    mainApp.use('/bot', botApi);
    console.log('✅ Bot API module loaded.');
  } catch (err) {
    console.log('⚠️ Bot API module not loaded:', err.message);
  }
}

// تشغيل السيرفر Express دائماً لتوفير نقطة /health لـ Railway
let server = null;
server = mainApp.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT} (Healthcheck active)`);
  if (process.env.BOT_ONLY !== 'true') {
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`🤖 Bot API: http://localhost:${PORT}/bot`);
  } else {
    console.log('ℹ️ Bot-only mode: Dashboard and API routes are disabled.');
  }
});

// --- Perform Bot Logins After Server Starts --- 
(async () => {
  // Initialize the bot (connect DB and load handlers) before attempting login
  try {
    const botModule = require('./bot/index');
    if (typeof botModule.start === 'function') {
      proMcBotClient = await botModule.start();
      console.log('✅ ProMcBot initialized.');
    } else if (botModule && botModule.user === null && botModule.options) {
      // It's already a Client object?!
      console.log('⚠️ require("./bot/index") returned a Client instance! Using it directly.');
      proMcBotClient = botModule;
    } else {
      console.error('❌ ProMcBot initialization failed: botModule.start is not a function. Returned keys:', Object.keys(botModule));
    }
  } catch (err) {
    console.error('❌ ProMcBot initialization failed:', err && err.message);
  }
  // Login ProMcBot (Main Bot) - Strict check for BOT1_1_TOKEN
  if (proMcBotClient) {
    if (!MAIN_BOT_TOKEN) {
      console.error('❌ ERROR: BOT1_1_TOKEN is missing! ProMcBot (Main) will not start to avoid token collision.');
    } else {
      const loggedIn = await loginBot(proMcBotClient, MAIN_BOT_TOKEN, "ProMcBot (Main)");
      if (!loggedIn) {
        console.error('❌ ProMcBot (Main) failed to log in. Check token and intents.');
      }
    }
  } else {
    console.error('❌ ProMcBot client instance is not available.');
  }

  // NOTE: Moddy Bot login is disabled to prevent duplicate message handling
  // The main bot (ProMcBot) will handle all command processing
  // if (moddyBotClient) {
  //   if (!MODDY_BOT_TOKEN) {
  //     console.warn('⚠️ MODDY_BOT_TOKEN (BOT1_TOKEN) is missing. Moddy Bot will not start.');
  //   } else {
  //     const loggedIn = await loginBot(moddyBotClient, MODDY_BOT_TOKEN, "Moddy Bot");
  //     if (!loggedIn) {
  //       console.error('❌ Moddy Bot failed to log in. Check token and intents.');
  //     }
  //   }
  // } else {
  //   console.warn('⚠️ Moddy Bot client instance is not available from dashboard exports.');
  // }
})();

// Handle process termination gracefully
process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server and Discord clients.');
  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
    });
  }
  if (proMcBotClient && proMcBotClient.isReady()) {
    proMcBotClient.destroy();
    console.log('ProMcBot client destroyed.');
  }
  if (moddyBotClient && moddyBotClient.isReady()) {
    moddyBotClient.destroy();
    console.log('Moddy Bot client destroyed.');
  }
  // Give some time for connections to close before exiting
  setTimeout(() => process.exit(0), 1000);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: shutting down gracefully.');
  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
