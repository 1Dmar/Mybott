const ServerOptions = require("../Models/bumpedServer"); // تأكد من أن هذا المسار صحيح
const cron = require("node-cron");

module.exports = async (client) => {
  console.log(`> Bump System Loaded !!`);
  
  cron.schedule("*/1 * * * *", async () => { // تحقق كل دقيقة
    const bumpedServers = await ServerOptions.find();
    if (!bumpedServers?.length) return;

    bumpedServers.forEach(async (server) => {
      const expirationTime = new Date(server.bumpedAt).getTime() + 12 * 60 * 60 * 1000; // 12 ساعة
      if (Date.now() >= expirationTime) {
        await ServerOptions.deleteOne({ guildId: server.guildId });
        console.log(`Server with guildId ${server.guildId} has been removed after bump expiration.`);
      }
    });
  });
};
