'use strict';

const { Collection, REST, Routes, PermissionFlagsBits } = require('discord.js');
const { loadCanonicalCommands, getCommandCatalog } = require('../commands/commandCatalog');

if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv-flow').config(); } catch (_) {}
}

function serializeCommand(command) {
  const payload = {
    name: command.name,
    description: command.description,
    options: Array.isArray(command.options) ? command.options : [],
  };
  if (command.userPermissions !== undefined) {
    const permissions = typeof command.userPermissions === 'bigint'
      ? command.userPermissions
      : BigInt(command.userPermissions);
    payload.default_member_permissions = permissions === 0n ? null : permissions.toString();
  }
  return payload;
}

function clearGuildCommands(rest, clientId, guildIds) {
  return guildIds.reduce(async (previous, guildId) => {
    await previous;
    try {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
      return { cleared: true, failed: false };
    } catch (error) {
      console.warn(`⚠️ Failed to clear legacy guild commands for ${guildId}: ${error.message}`);
      return { cleared: false, failed: true };
    }
  }, Promise.resolve({ cleared: 0, failed: 0 }));
}

module.exports = async function registerSlashCommands(client) {
  try {
    const commands = loadCanonicalCommands();
    const names = commands.map(command => command.name);
    const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicateNames.length) throw new Error(`Duplicate canonical command names: ${[...new Set(duplicateNames)].join(', ')}`);

    client.scommands = new Collection(commands.map(command => [command.name, command]));
    client.commandCatalog = getCommandCatalog();
    console.log(`✅ Loaded ${client.scommands.size} canonical slash command groups: ${names.join(', ')}`);

    if (!process.env.BOT1_1_TOKEN) {
      console.warn('⚠️ BOT1_1_TOKEN is not configured; command registry loaded locally but Discord synchronization is disabled.');
      return;
    }

    client.once('ready', async () => {
      const rest = new REST({ version: '10' }).setToken(process.env.BOT1_1_TOKEN);
      const clientId = client.user?.id;
      if (!clientId) {
        console.error('❌ Cannot synchronize commands before Discord client identity is available.');
        return;
      }

      const body = commands.map(serializeCommand);
      try {
        // PUT is authoritative: removed commands disappear from the global registry.
        await rest.put(Routes.applicationCommands(clientId), { body });
        console.log(`✅ Synchronized ${body.length} global command groups; removed commands are no longer registered.`);
      } catch (error) {
        console.error(`❌ Global command synchronization failed: ${error.message}`);
        return;
      }

      // Older releases registered every command per guild. Clear that stale layer
      // so users see only the single global taxonomy and never duplicate commands.
      if (process.env.COMMAND_SYNC_CLEAR_GUILDS !== 'false') {
        try {
          const guilds = await client.guilds.fetch();
          let cleared = 0;
          let failed = 0;
          for (const [guildId] of guilds) {
            try {
              await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
              cleared += 1;
            } catch (error) {
              failed += 1;
              console.warn(`⚠️ Failed to clear legacy guild commands for ${guildId}: ${error.message}`);
            }
          }
          console.log(`🧹 Cleared legacy guild command registries: ${cleared} succeeded, ${failed} failed.`);
        } catch (error) {
          console.warn(`⚠️ Could not enumerate guilds for legacy command cleanup: ${error.message}`);
        }
      }
    });
  } catch (error) {
    console.error(`💥 Canonical slash command registry failed: ${error.message}`);
    client.scommands = new Collection();
  }
};
