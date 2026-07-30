module.exports = {
  EMBED_COLORS: {
    ONLINE: '#00FF00',
    OFFLINE: '#FF0000'
  },
  EMOJIS: {
    SERVER: '<:Information:1410147645883678763>',
    ONLINE: '<:Online:1410178650070061096>',
    OFFLINE: '<:Offline:1410178629098278922>',
    PLAYERS: '<:Player:1410147631308603494>',
    VERSION: '<:Achievement:1410147661008605224>'
  },
  DEFAULT_UPDATE_INTERVAL: 5,
  MIN_UPDATE_INTERVAL: 1,
  MAX_UPDATE_INTERVAL: 60,
  MESSAGES: {
    PERMISSION_DENIED: '<:Warning:1410147601281581118> You need MANAGE_GUILD permission!',
    SERVER_NOT_FOUND: '<:Warning:1410147601281581118> Server not found in database!',
    SETUP_SUCCESS: (channel) => `<:Check:1410147529630289960> Status bar setup in ${channel} complete!`,
    UPDATE_SUCCESS: '<:Check:1410147529630289960> Status bar updated successfully!',
    INTERVAL_UPDATED: (minutes) => `<:Under_maintenance:1410178614204432474> Update interval set to ${minutes} minutes!`
  }
};
