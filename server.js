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

// Centralized Bot Login Management
const loginBot = async (client, token, name) => {
  if (!client || !token || client.user) return;
  try {
    await client.login(token);
    console.log(`✅ ${name} logged in successfully!`);
  } catch (err) {
    console.error(`❌ ${name} Login Error:`, err.message);
  }
};

// Login ProMcBot (Main Bot)
if (bot1 && bot1.client) {
  loginBot(bot1.client, process.env.BOT1_1_TOKEN, "ProMcBot (Main)");
} else if (bot2Client) {
  loginBot(bot2Client, process.env.BOT1_1_TOKEN, "ProMcBot (Fallback)");
}

// Login Moddy Bot
if (bot1 && bot1.client1) {
  loginBot(bot1.client1, process.env.BOT1_TOKEN, "Moddy Bot");
}
