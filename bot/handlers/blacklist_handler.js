const ServerOptions = require("../Models/BlackList"); // تأكد من أن هذا المسار صحيح
const cron = require("node-cron");

module.exports = async (client) => {
  console.log(`> Blacklist System Loaded !!`);
  
  cron.schedule("*/1 * * * *", async () => { // تحقق كل دقيقة
    const blacklistedServers = await ServerOptions.find({ isBlacklisted: 'true', isPermanent: false });
    if (!blacklistedServers?.length) return;

    blacklistedServers.forEach(async (server) => {
      if (Date.now() >= server.expiresAt) {
        await ServerOptions.deleteOne({ guildIds: server.guildIds });
      }
    });
  });
};
