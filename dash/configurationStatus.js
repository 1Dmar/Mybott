'use strict';

function getConfigurationStatus(env = process.env) {
  return {
    pluginProvisioningConfigured: Boolean(String(env.PLUGIN_ENCRYPTION_KEY || '').trim()),
    mongoConfigured: Boolean(String(env.MONGO_URL || env.MONGO_URI || '').trim()),
    discordOAuthConfigured: Boolean(String(env.DISCORD_CLIENT_ID || '').trim() && String(env.DISCORD_CLIENT_SECRET || '').trim()),
    paypalConfigured: Boolean(String(env.PAYPAL_CLIENT_ID || '').trim() && String(env.PAYPAL_CLIENT_SECRET || '').trim() && String(env.PAYPAL_WEBHOOK_ID || '').trim()),
  };
}

module.exports = { getConfigurationStatus };
