module.exports = {
  EMBED_COLORS: {
    ONLINE: '#00FF00',
    OFFLINE: '#FF0000'
  },
  EMOJIS: {
    SERVER: '🖥️',
    ONLINE: '🟢',
    OFFLINE: '🔴',
    PLAYERS: '👥',
    VERSION: '🌐'
  },
  DEFAULT_UPDATE_INTERVAL: 5,
  MIN_UPDATE_INTERVAL: 1,
  MAX_UPDATE_INTERVAL: 60,
  MESSAGES: {
    PERMISSION_DENIED: '❌ You need MANAGE_GUILD permission!',
    SERVER_NOT_FOUND: '❌ Server not found in database!',
    SETUP_SUCCESS: (channel) => `✅ Status bar setup in ${channel} complete!`,
    UPDATE_SUCCESS: '✅ Status bar updated successfully!',
    INTERVAL_UPDATED: (minutes) => `⏱️ Update interval set to ${minutes} minutes!`
  }
};
