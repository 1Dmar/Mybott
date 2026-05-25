const { Collection } = require("discord.js");
const { readdirSync } = require("fs");
const path = require('path');
const { REST, Routes } = require("discord.js");

// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv-flow').config();
}

module.exports = async (client) => {
  try {
    // 1. Verify token exists
    if (!process.env.BOT1_1_TOKEN) {
      console.error("❌ ERROR: BOT1_1_TOKEN is not defined in environment variables!");
      console.error("ℹ️ Solution: Add BOT1_1_TOKEN to your Railway environment variables.");
      return;
    }

    client.scommands = new Collection();
    let allCommands = [];

    // 2. Load commands from folder
    const loadCommands = () => {
      try {
        const slashPath = path.join(__dirname, "..", "Commands", "Slash");
        
        // Check if directory exists
        if (!require('fs').existsSync(slashPath)) {
          console.warn("⚠️ Slash commands directory not found:", slashPath);
          return;
        }

        readdirSync(slashPath).forEach((dir) => {
          const dirPath = path.join(slashPath, dir);
          
          // Check if it's a directory
          if (!require('fs').statSync(dirPath).isDirectory()) return;
          
          const commands = readdirSync(dirPath);
          
          for (const cmd of commands) {
            try {
              const fullPath = path.join(dirPath, cmd);
              if (require('fs').statSync(fullPath).isDirectory()) continue;
              
              delete require.cache[require.resolve(fullPath)];
              const command = require(fullPath);
              
              if (command?.name && command?.description && command?.run) {
                client.scommands.set(command.name, command);
                allCommands.push({
                  name: command.name,
                  description: command.description,
                  options: command.options || [],
                  default_permission: command.defaultPermission !== false,
                  default_member_permissions: command.userPermissions?.bitfield?.toString() || null
                });
                console.log(`${client.emojis.SUCCESS} Loaded command: ${command.name}`);
              } else {
                console.warn(`${client.emojis.WARNING}️ Command ${cmd} is missing required fields (name, description, or run)`);
              }
            } catch (cmdError) {
              console.error(`${client.emojis.ERROR} Error loading command ${cmd}:`, cmdError.message);
            }
          }
        });
        console.log(`${client.emojis.SUCCESS} Total loaded: ${client.scommands.size} slash commands`);
      } catch (error) {
        console.error("❌ Error loading commands:", error.message);
      }
    };

    loadCommands();

    // 3. Register commands when bot is ready
    client.once("ready", async () => {
      try {
        if (!client.user?.id) {
          throw new Error("Client user not available");
        }

        const rest = new REST({ version: "10" }).setToken(process.env.BOT1_1_TOKEN);
        const clientId = client.user.id;

        console.log(`⏳ Starting command registration for client ${clientId}...`);

        // Get guild ID from environment
        const GUILD_ID = process.env.TEST_GUILD_ID || process.env.GuildID || "";
        


        // Optimized Registration Strategy:
        // 1. Guild Registration (Instant) - Always try this for all guilds the bot is in
        const guilds = await client.guilds.fetch();
        console.log(`🏰 Attempting guild command registration for ${guilds.size} guilds...`);
        
        for (const [guildId, guild] of guilds) {
          try {
            await rest.put(
              Routes.applicationGuildCommands(clientId, guildId),
              { body: allCommands }
            );
            console.log(`✅ Registered ${allCommands.length} commands for guild: ${guild.name} (${guildId})`);
          } catch (guildError) {
            console.warn(`⚠️ Failed to register commands for guild ${guildId}:`, guildError.message);
          }
        }

        // 2. Global Registration (Background) - Do this once for all other servers
        console.log("🌍 Starting global command registration (may take up to 1 hour to propagate)...");
        try {
          await rest.put(
            Routes.applicationCommands(clientId),
            { body: allCommands }
          );
          console.log(`✅ Successfully registered ${allCommands.length} GLOBAL slash commands`);
        } catch (globalError) {
          console.error("❌ Global registration failed:", globalError.message);
        }

      } catch (error) {
        console.error("💥 Critical error in command registration:", error);
      }
    });

  } catch (error) {
    console.error("💥 Critical error in slash handler:", error);
  }
};
