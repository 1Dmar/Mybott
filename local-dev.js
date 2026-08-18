/* Local dev: starts an in-memory MongoDB, then loads the dashboard */
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log('[local-dev] MongoMemoryServer running at', uri);
  process.env.MONGO_URL = uri;
  process.env.DASHBOARD_DB = uri;
  process.env.DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'dummy';
  process.env.DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'dummy';
  process.env.BUG_WEBHOOK_ID = process.env.BUG_WEBHOOK_ID || 'dummy';
  process.env.BUG_WEBHOOK_TOKEN = process.env.BUG_WEBHOOK_TOKEN || 'dummy';
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'local-dev-secret';
  const { app } = require('./dash/index.js');
  app.listen(3999, () => console.log('[local-dev] Dashboard listening on :3999'));
})().catch(err => { console.error('[local-dev]', err); process.exit(1); });
