// Bot configuration - Fixed for Railway deployment
// Only load dotenv in development environment
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const resolveEnv = (...names) => names.map((name) => process.env[name]).find((value) => value);
const MAIN_BOT_TOKEN = resolveEnv('BOT1_1_TOKEN', 'TOKEN', 'BOT_TOKEN', 'DISCORD_TOKEN', 'MAIN_BOT_TOKEN');

if (MAIN_BOT_TOKEN && !process.env.BOT1_1_TOKEN) {
  process.env.BOT1_1_TOKEN = MAIN_BOT_TOKEN;
}

module.exports = {
  TOKEN: MAIN_BOT_TOKEN,
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
    SERVER: "🖥️",
    ONLINE: "🟢",
    OFFLINE: "🔴",
    PLAYERS: "👥",
    VERSION: "📝"
  }
};
