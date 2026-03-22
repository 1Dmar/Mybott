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

// تسجيل دخول البوتات (فقط إذا لم يتم تسجيل الدخول بالفعل في bot/index.js)
// Bot 1 (Dashboard Bots) - only login if not already logged in
if (bot1 && bot1.client && !bot1.client.user) {
  bot1.client.login(process.env.BOT1_TOKEN).catch(err => 
    console.error("❌ Bot 1 Client Login Error:", err.message)
  );
}
if (bot1 && bot1.client1 && !bot1.client1.user) {
  bot1.client1.login(process.env.BOT1_1_TOKEN).catch(err => 
    console.error("❌ Bot 1 Client1 Login Error:", err.message)
  );
}

// Bot 2 (Main Bot) - Login is handled in bot/index.js, but we check here as fallback
// The bot should already be logged in from bot/index.js, this is just a safety check
if (bot2Client && bot2Client.login && !bot2Client.user) {
  // Wait a bit to see if the bot logs in from the handler
  setTimeout(() => {
    if (!bot2Client.user) {
      bot2Client.login(process.env.BOT1_1_TOKEN).catch(err => 
        console.error("❌ Bot 2 Login Error:", err.message)
      );
    }
  }, 5000);
}
