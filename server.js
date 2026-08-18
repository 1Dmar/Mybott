// server.js - Final Hardened Fix for promcbot.dev
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv-flow').config();
  } catch (e) {}
}

const express = require('express');
const mainApp = express();

// Trust proxy is critical for Railway/Cloudflare to pass the correct Host header
mainApp.set('trust proxy', true);

const PRIMARY_DOMAIN = "promcbot.dev";
const PROTOCOL = "https";

// Force CALLBACK_URL to use the primary domain
process.env.CALLBACK_URL = `${PROTOCOL}://${PRIMARY_DOMAIN}/auth/discord/callback`;

// 1. Health check endpoint (Railway needs this to stay on the local/internal host)
mainApp.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', domain: req.get('host') });
});

// 1b. Safe environment diagnostics (public, no secrets exposed)
mainApp.get('/api/env-check', async (req, res) => {
  const checks = {
    nodeEnv: process.env.NODE_ENV || 'development',
    ownerIdsSet: !!(process.env.OWNER_ID && process.env.OWNER_ID.trim()),
    ownerIds: (process.env.OWNER_ID || '').split(',').filter(Boolean),
    mongoSet: !!(process.env.MONGO_URL || process.env.MONGO_URI),
    discordOAuthSet: !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
    callbackHost: process.env.CALLBACK_URL || '',
    corsOrigin: process.env.CORS_ORIGIN || '',
    railwayDomain: process.env.RAILWAY_PUBLIC_DOMAIN || '',
    deployTime: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  };
  // Live DB connectivity probe (real diagnosis, not just env var presence)
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      checks.mongoConnected = true;
      try {
        const WebsiteSettings = mongoose.model('website-settings');
        checks.websiteCount = await WebsiteSettings.countDocuments({});
        checks.websiteEnabled = await WebsiteSettings.countDocuments({ enabled: true });
        if (req.query.guildId) {
          const s = await WebsiteSettings.findOne({ guildId: String(req.query.guildId) }).lean();
          checks.websiteForGuild = s ? { enabled: s.enabled, siteName: s.siteName, updatedAt: s.updatedAt } : null;
        }
      } catch (e) { checks.websiteError = e.message; }
    } else {
      checks.mongoConnected = false;
      checks.mongoReadyState = mongoose.connection.readyState;
    }
  } catch (e) {
    checks.dbProbeError = e.message;
  }
  res.status(200).json(checks);
});

// 2. Strict Domain Canonicalization Middleware
mainApp.use((req, res, next) => {
  // Never redirect health checks
  if (req.path === '/health') return next();

  // Get the hostname from the request (trusting the proxy)
  const host = req.hostname || req.get('host') || '';
  
  // If the host is a Railway default domain (up.railway.app)
  // we force a redirect to the custom domain promcbot.dev
  if (host.includes('railway.app') && !host.includes(PRIMARY_DOMAIN)) {
    console.log(`[Domain Guard] Redirecting ${host}${req.originalUrl} -> ${PRIMARY_DOMAIN}`);
    
    // Use 308 Permanent Redirect to preserve the method and ensure it's cached by browsers/proxies
    return res.redirect(308, `${PROTOCOL}://${PRIMARY_DOMAIN}${req.originalUrl}`);
  }
  
  next();
});

// Bot API and Dashboard injection
const PORT = process.env.PORT || 8080;

if (process.env.BOT_ONLY !== 'true') {
  try {
    const dashboardModule = require('./dash/index');
    if (dashboardModule && dashboardModule.app) {
      // Mount dashboard
      mainApp.use('/', dashboardModule.app);
      console.log('✅ Dashboard mounted successfully');
    } else {
      throw new Error('Dashboard app not found in module exports');
    }
    
    const botApi = require('./bot/api/index');
    mainApp.use('/bot', express.json());
    mainApp.use('/bot', botApi);
  } catch (err) {
    console.error('❌ CRITICAL ERROR: Dashboard failed to load:', err.stack || err.message);
    process.exit(1); // Force exit so Railway shows deployment failure
  }
}

let server = mainApp.listen(PORT, () => {
  console.log(`✅ Server active on port ${PORT}. Canonical Domain: ${PRIMARY_DOMAIN}`);
});

// Bot Start
(async () => {
  try {
    const botModule = require('./bot/index');
    const client = typeof botModule.start === 'function' ? await botModule.start() : botModule;
    if (client && process.env.BOT1_1_TOKEN) {
      await client.login(process.env.BOT1_1_TOKEN);
      console.log('✅ Bot logged in');
    }
  } catch (err) {
    console.error('❌ Bot error:', err.message);
  }
})();

