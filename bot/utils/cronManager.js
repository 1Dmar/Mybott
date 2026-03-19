const cron = require('node-cron');
const { updateServerStatus } = require('./statusUpdater');

const cronJobs = new Map();

module.exports.scheduleCronJobs = async (client) => {
  cronJobs.forEach(job => job.stop());
  cronJobs.clear();

  // Check if client.db and required models exist
  if (!client.db || !client.db.StatusBar || !client.db.Server) {
    console.error('Database models not initialized. Cron jobs not scheduled.');
    return 0;
  }

  try {
    const allSettings = await client.db.StatusBar.find();
    
    for (const settings of allSettings) {
      const job = cron.schedule(`*/${settings.updateInterval} * * * *`, async () => {
        try {
          const server = await client.db.Server.findOne({ serverId: settings.serverId });
          if (server) {
            await updateServerStatus(client, server, settings);
          }
        } catch (error) {
          console.error(`Cron Job Error [${settings.serverId}]:`, error.message);
        }
      });

      cronJobs.set(settings.serverId, job);
    }
    
    return cronJobs.size;
  } catch (error) {
    console.error('Failed to fetch status settings:', error.message);
    return 0;
  }
};