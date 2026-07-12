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

// Middleware to handle custom domain and redirect from random Railway links
mainApp.use((req, res, next) => {
  const customDomain = process.env.CUSTOM_DOMAIN; // Example: bot.yourdomain.com
  const host = req.get('host');
  
  // If a custom domain is set and the request is coming from a different host (like railway.app)
  if (customDomain && host !== customDomain && !host.includes('localhost')) {
    return res.redirect(301, `https://${customDomain}${req.originalUrl}`);
  }
  next();
});

// Trust proxy for Railway
mainApp.set('trust proxy', 1);

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
try {
  proMcBotClient = require('./bot/index');
  console.log('✅ ProMcBot module loaded.');
} catch (err) {
  console.error('❌ Failed to load ProMcBot module:', err.message);
}

// Import the dashboard module, which contains Moddy Bot client
let dashboardModule = null;
let moddyBotClient = null;
try {
  dashboardModule = require('./dash/index');
  if (dashboardModule && dashboardModule.app) {
    // Determine the base URL for Railway
    const domain = process.env.RAILWAY_PUBLIC_DOMAIN || `localhost:${PORT}`;
    const protocol = process.env.RAILWAY_PUBLIC_DOMAIN ? 'https' : 'http';
    process.env.CALLBACK_URL = `${protocol}://${domain}/auth/discord/callback`;
    
    mainApp.use('/', dashboardModule.app);
    console.log(`✅ Dashboard module loaded. Callback URL set to: ${process.env.CALLBACK_URL}`);
  }
  // NOTE: We intentionally do NOT extract client1 to prevent duplicate message handling
  // The Moddy Bot (client1) should only be used for dashboard features, not for command handling
  // if (dashboardModule && dashboardModule.client1) {
  //   moddyBotClient = dashboardModule.client1;
  //   console.log('✅ Moddy Bot client (client1 from dashboard) extracted.');
  // }
} catch (err) {
  console.log('⚠️ Dashboard module not loaded or client1 not found:', err.message);
}

// Inject bot API
try {
  const botApi = require('./bot/api/index');
  mainApp.use('/bot', express.json()); // Add json parsing for /bot
  mainApp.use('/bot', botApi);
  console.log('✅ Bot API module loaded.');
} catch (err) {
  console.log('⚠️ Bot API module not loaded:', err.message);
}

// تشغيل السيرفر Express أولاً
const PORT = process.env.PORT || 8080;
const server = mainApp.listen(PORT, () => {
  console.log(`✅ Main server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dash`);
  console.log(`🤖 Bot API: http://localhost:${PORT}/bot`);
});

// --- Perform Bot Logins After Server Starts --- 
(async () => {
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
  server.close(() => {
    console.log('HTTP server closed.');
  });
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
