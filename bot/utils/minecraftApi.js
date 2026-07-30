const axios = require('axios');
const MinecraftConfig = require('../Models/MinecraftConfig');

/**
 * Get Minecraft API config for a guild from DB
 */
async function getMcConfig(guildId) {
  const config = await MinecraftConfig.findOne({ guildId });
  if (!config) throw new Error('NO_MC_CONFIG');
  return config;
}

/**
 * Build auth headers from config
 */
function buildHeaders(config) {
  const headers = {
    'Authorization': `Bearer ${config.bearerToken}`,
    'Content-Type': 'application/json',
  };
  if (config.premiumKey) headers['X-Premium-Key'] = config.premiumKey;
  return headers;
}

/** GET /player/{username} */
async function getPlayer(guildId, username) {
  const config = await getMcConfig(guildId);
  const res = await axios.get(
    `${config.apiUrl}/player/${encodeURIComponent(username)}`,
    { headers: buildHeaders(config), timeout: 8000 }
  );
  return res.data;
}

/** GET /players */
async function getPlayers(guildId) {
  const config = await getMcConfig(guildId);
  const res = await axios.get(
    `${config.apiUrl}/players`,
    { headers: buildHeaders(config), timeout: 8000 }
  );
  return res.data;
}

/** GET /info */
async function getServerInfo(guildId) {
  const config = await getMcConfig(guildId);
  const res = await axios.get(
    `${config.apiUrl}/info`,
    { headers: buildHeaders(config), timeout: 8000 }
  );
  return res.data;
}

/** POST /execute */
async function executeCommand(guildId, commands, waitForPlayer = null) {
  const config = await getMcConfig(guildId);
  const body = { commands: Array.isArray(commands) ? commands : [commands] };
  if (waitForPlayer) body.waitForPlayer = waitForPlayer;
  const res = await axios.post(
    `${config.apiUrl}/execute`,
    body,
    { headers: buildHeaders(config), timeout: 10000 }
  );
  return res.data;
}

/** GET /leaderboard */
async function getLeaderboard(guildId) {
  const config = await getMcConfig(guildId);
  const res = await axios.get(
    `${config.apiUrl}/leaderboard`,
    { headers: buildHeaders(config), timeout: 8000 }
  );
  return res.data;
}

module.exports = { getMcConfig, getPlayer, getPlayers, getServerInfo, executeCommand, getLeaderboard };
