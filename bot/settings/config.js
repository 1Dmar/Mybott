require('dotenv').config();


module.exports = {
  TOKEN: process.env.BOT1_1_TOKEN,
  PREFIX: process.env.PREFIX || "!",
  MONGO_URL: process.env.MONGO_URL,
    apikey: "promc.bdvhhjHDSF4DS5F5f4dsfdsgvjkdsjV5DS45",
  Slash: {
    Global: true,
    GuildID: process.env.GuildID || "1058104907204395008",
  },
};
