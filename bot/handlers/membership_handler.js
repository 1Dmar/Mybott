const Server = require("../Models/User"); 
const cron = require("node-cron");

// set the schedule, find the servers in the database.
module.exports = async (client) => {
  console.log("> MemberShip System Loaded !!");
  cron.schedule("*/60 * * * * *", async () => {
    const servers = await Server.find({ ismembership: true });
    if (!servers?.length) return;
    servers?.forEach(async (server) => {
      if (Date.now() >= server.membership.expiresAt) {
        // Default: The server is not a membership server
        server.ismembership = false;
        server.membership.redeemedBy = [];
        server.membership.redeemedAt = null;
        server.membership.expiresAt = null;
        server.membership.plan = null;
        // Save the updated server within the userSettings.
        const newServer = await server.save({ new: true }).catch(() => {});
        client.userSettings.set(newServer.Id, newServer);
      }
    });
  });
};
