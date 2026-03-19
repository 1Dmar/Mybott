require('dotenv-flow').config();
const express = require('express');
const mainApp = express();

// جسر التوافق للمشروع الأول
const bot1 = require('./dash/index');
if (typeof bot1 === 'function') {
  mainApp.use('/', bot1); // استخدم كـ router
} else if (bot1.app && typeof bot1.app === 'function') {
  mainApp.use('/', bot1.app); // استخدم التطبيق المدمج
}

// جسر التوافق للمشروع الثاني 
const bot2 = require('./bot/events/ready');
const bot2Client = require('./bot/index');

/*if (typeof bot2Router === 'function') {
  mainApp.use('/bot', bot2Router); // استخدم كـ router
} else if (bot2Router.router && typeof bot2Router.router === 'function') {
  mainApp.use('/bot', bot2Router.router); // استخدم التطبيق المدمج
}*/

if (typeof bot2 === 'function') {
  mainApp.use('/', bot2); // استخدم كـ router
} else if (bot2.router && typeof bot2.router === 'function') {
  mainApp.use('/', bot2.router); // استخدم التطبيق المدمج
}


// تشغيل السيرفر
const PORT = process.env.PORT || 6269;
mainApp.listen(PORT, () => {
  console.log(`Main server running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dash`);
  console.log(`Bot API: http://localhost:${PORT}/bot`);
});

// تسجيل دخول البوتات
if (bot1.client) bot1.client.login(process.env.BOT1_TOKEN);
if (bot1.client1) bot1.client1.login(process.env.BOT1_1_TOKEN);
if (bot2Client.login) bot2Client.login(process.env.BOT1_TOKEN);