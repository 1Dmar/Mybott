// Main server file - Fixed version
// Load environment variables (Railway provides these directly, dotenv is for local dev)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv-flow').config();
}

const express = require('express');
const mainApp = express();

// Trust proxy for Railway
mainApp.set('trust proxy', 1);

// جسر التوافق للمشروع الأول (Dashboard)
let bot1 = null;
try {
  bot1 = require('./dash/index');
  if (typeof bot1 === 'function') {
    mainApp.use('/', bot1);
  } else if (bot1 && bot1.app && typeof bot1.app === 'function') {
    mainApp.use('/', bot1.app);
  }
} catch (err) {
  console.log('⚠️ Dashboard module not loaded:', err.message);
}

// جسر التوافق للمشروع الثاني (Bot)
// Note: The bot client is created in bot/index.js and we just reference it here
let bot2Client = null;
try {
  bot2Client = require('./bot/index');
} catch (err) {
  console.error('❌ Failed to load bot module:', err.message);
}

// تشغيل السيرفر
const PORT = process.env.PORT || 8080;
mainApp.listen(PORT, () => {
  console.log(`✅ Main server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dash`);
  console.log(`🤖 Bot API: http://localhost:${PORT}/bot`);
});

// تسجيل دخول البوتات
// BOT1_1_TOKEN = Main Bot (ProMcBot)
// BOT1_TOKEN = Moddy Bot

// Dashboard Bots - Login only if not already logged in
if (bot1) {
  if (bot1.client && !bot1.client.user && process.env.BOT1_1_TOKEN) {
    bot1.client.login(process.env.BOT1_1_TOKEN).catch(err => 
      console.error("❌ ProMcBot (Dashboard Client) Login Error:", err.message)
    );
  }
  if (bot1.client1 && !bot1.client1.user && process.env.BOT1_TOKEN) {
    bot1.client1.login(process.env.BOT1_TOKEN).catch(err => 
      console.error("❌ Moddy Bot (Dashboard Client1) Login Error:", err.message)
    );
  }
}

// Main Bot Logic (bot/index.js)
// The bot is already handled via bot1.client if it's the same client, 
// but we ensure at least one login happens for the main bot.
if (bot2Client && !bot2Client.user && !bot1?.client?.user && process.env.BOT1_1_TOKEN) {
  bot2Client.login(process.env.BOT1_1_TOKEN).catch(err => 
    console.error("❌ ProMcBot (Main Logic) Login Error:", err.message)
  );
}
