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
    }
    
    const botApi = require('./bot/api/index');
    mainApp.use('/bot', express.json());
    mainApp.use('/bot', botApi);
  } catch (err) {
    console.warn('⚠️ Module load error:', err.message);
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
