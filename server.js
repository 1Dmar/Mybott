// server.js - Fixed version
// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv-flow').config();
  } catch (e) {}
}

// --- Domain & OAuth Configuration ---
// Set CALLBACK_URL BEFORE requiring any other modules to ensure they use the correct domain
const DOMAIN = "promcbot.dev";
const PROTOCOL = "https";
process.env.CALLBACK_URL = `${PROTOCOL}://${DOMAIN}/auth/discord/callback`;

const express = require('express');
const mainApp = express();

// Trust proxy is essential for Railway to see the correct hostname/protocol
mainApp.set('trust proxy', true);

// Middleware to prevent unwanted redirection to Railway domain
mainApp.use((req, res, next) => {
  const host = req.get('host') || '';
  // If the request is coming from a railway.app domain, redirect it back to the custom domain
  if (host.includes('railway.app')) {
    return res.redirect(301, `${PROTOCOL}://${DOMAIN}${req.originalUrl}`);
  }
  next();
});

// Health check endpoint
mainApp.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Centralized Bot Login Management
const loginBot = async (clientInstance, token, name) => {
  if (!clientInstance || !token) return false;
  if (clientInstance.user) return true;
  try {
    await clientInstance.login(token);
    console.log(`✅ ${name} logged in successfully!`);
    return true;
  } catch (err) {
    console.error(`❌ ${name} Login Error:`, err.message);
    return false;
  }
};

const MAIN_BOT_TOKEN = process.env.BOT1_1_TOKEN;
let proMcBotClient = null;
const PORT = process.env.PORT || 8080;

// Import the dashboard module
if (process.env.BOT_ONLY !== 'true') {
  try {
    const dashboardModule = require('./dash/index');
    if (dashboardModule && dashboardModule.app) {
      mainApp.use('/', dashboardModule.app);
      console.log(`✅ Dashboard module loaded. Domain: ${DOMAIN}`);
    }
  } catch (err) {
    console.log('⚠️ Dashboard module not loaded:', err.message);
  }
}

// Inject bot API
if (process.env.BOT_ONLY !== 'true') {
  try {
    const botApi = require('./bot/api/index');
    mainApp.use('/bot', express.json());
    mainApp.use('/bot', botApi);
  } catch (err) {
    console.log('⚠️ Bot API module not loaded:', err.message);
  }
}

let server = mainApp.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// Bot Initialization
(async () => {
  try {
    const botModule = require('./bot/index');
    if (typeof botModule.start === 'function') {
      proMcBotClient = await botModule.start();
    } else {
      proMcBotClient = botModule;
    }
    
    if (proMcBotClient && MAIN_BOT_TOKEN) {
      await loginBot(proMcBotClient, MAIN_BOT_TOKEN, "ProMcBot");
    }
  } catch (err) {
    console.error('❌ Bot initialization failed:', err.message);
  }
})();

// Graceful shutdown
process.on('SIGINT', () => {
  if (server) server.close();
  if (proMcBotClient) proMcBotClient.destroy();
  setTimeout(() => process.exit(0), 1000);
});
