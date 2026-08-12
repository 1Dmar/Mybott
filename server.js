// server.js - Final fix for custom domain and Railway redirection
// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv-flow').config();
  } catch (e) {}
}

const express = require('express');
const mainApp = express();

// Trust proxy is essential for Railway to see the correct hostname/protocol
mainApp.set('trust proxy', true);

// --- Domain & OAuth Configuration ---
// We use promcbot.dev as the primary domain.
// Railway's PUBLIC_URL or RAILWAY_STATIC_URL might point to the .up.railway.app domain.
const PRIMARY_DOMAIN = "promcbot.dev";
const PROTOCOL = "https";

// Set CALLBACK_URL globally for all modules
process.env.CALLBACK_URL = `${PROTOCOL}://${PRIMARY_DOMAIN}/auth/discord/callback`;

// 1. Health check endpoint MUST be first and NOT redirected
mainApp.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 2. Middleware to handle domain canonicalization
mainApp.use((req, res, next) => {
  // Skip for health check
  if (req.path === '/health') return next();

  const host = req.get('host') || '';
  
  // If the request is NOT coming from our primary domain, and it's a railway domain
  // redirect it to the primary domain to maintain session and avoid cross-domain issues.
  if (host.includes('railway.app') && !host.includes(PRIMARY_DOMAIN)) {
    console.log(`[Redirect] Canonicalizing ${host}${req.originalUrl} to ${PRIMARY_DOMAIN}`);
    return res.redirect(301, `${PROTOCOL}://${PRIMARY_DOMAIN}${req.originalUrl}`);
  }
  
  next();
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
      console.log(`✅ Dashboard module loaded. Primary Domain: ${PRIMARY_DOMAIN}`);
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
