// Bot configuration - Fixed for Railway deployment
// Only load dotenv in development environment
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

module.exports = {
  TOKEN: process.env.BOT1_1_TOKEN,
  PREFIX: process.env.PREFIX || "!",
  MONGO_URL: process.env.MONGO_URL,
  apikey: process.env.API_KEY || "promc.default-key-change-in-production",
  Slash: {
    Global: process.env.SLASH_GLOBAL === 'true' || true,
    GuildID: process.env.TEST_GUILD_ID || process.env.GuildID || "",
  },
  EMBED_COLORS: {
    ONLINE: "#43b581",
    OFFLINE: "#f04747",
    DEFAULT: "#7289da"
  },
  EMOJIS: {
    SERVER: "${client.emojis.SERVER}",
    ONLINE: "${client.emojis.ONLINE}",
    OFFLINE: "${client.emojis.OFFLINE}",
    PLAYERS: "${client.emojis.MEMBERS}",
    VERSION: "${client.emojis.EDIT}"
  }
};
