const { Client, Collection } = require("discord.js");
const { readdirSync } = require("fs");
const path = require('path');
const { REST, Routes } = require("discord.js");
require('dotenv-flow').config();

module.exports = async (client) => {
  try {
    // 1. Verify token exists
    const { TOKEN } = require("../settings/config");
    if (!TOKEN) {
      throw new Error("Bot token is not defined in settings/config");
    }

    client.scommands = new Collection();
    let allCommands = [];

    // 2. Load commands from folder
    const loadCommands = () => {
      try {
        const slashPath = path.join(__dirname, "..", "Commands", "Slash");
        readdirSync(slashPath).forEach((dir) => {
          const commands = readdirSync(`${slashPath}/${dir}`).filter(f => f.endsWith(".js"));
          
          for (const cmd of commands) {
            try {
              delete require.cache[require.resolve(`../Commands/Slash/${dir}/${cmd}`)];
              const command = require(`../Commands/Slash/${dir}/${cmd}`);
              
              if (command?.name && command?.description && command?.run) {
                client.scommands.set(command.name, command);
                allCommands.push({
                  name: command.name,
                  description: command.description,
                  options: command.options || [],
                  default_permission: command.defaultPermission !== false,
                  default_member_permissions: command.userPermissions?.bitfield?.toString() || null
                });
                console.log(`✅ Loaded command: ${command.name}`);
              }
            } catch (cmdError) {
              console.error(`❌ Error loading command ${cmd}:`, cmdError);
            }
          }
        });
        console.log(`✅ Total loaded: ${client.scommands.size} slash commands`);
      } catch (error) {
        console.error("❌ Error loading commands:", error);
      }
    };

    loadCommands();

    // 3. Register commands when bot is ready
    client.once("ready", async () => {
      try {
        if (!client.user?.id) {
          throw new Error("Client user not available");
        }

        const { TOKEN } = require("../settings/config");
        const rest = new REST({ version: "10" }).setToken(TOKEN);
        const clientId = client.user.id;

        console.log(`🔄 Starting command registration for client ${clientId}...`);

        // Try guild-specific registration first (more likely to work)
        const GUILD_ID = process.env.TEST_GUILD_ID || "1226151054178127872";
        
        try {
          console.log(`🔄 Attempting guild command registration for guild ${GUILD_ID}...`);
          await rest.put(
            Routes.applicationGuildCommands(clientId, GUILD_ID),
            { body: allCommands }
          );
          console.log(`🏰 Successfully registered ${allCommands.length} GUILD slash commands for ${GUILD_ID}`);
        } catch (guildError) {
          console.warn("⚠️ Guild registration failed:", guildError.message);
          console.log("🔄 Trying global registration...");
          
          // Fallback to global registration
          try {
            await rest.put(
              Routes.applicationCommands(clientId),
              { body: allCommands }
            );
            console.log(`🌍 Successfully registered ${allCommands.length} GLOBAL slash commands`);
          } catch (globalError) {
            console.error("❌ Global registration failed:", globalError.message);
            
            if (globalError.code === 50001) {
              console.error("🔒 Missing 'Applications Commands' scope in bot invite link");
              console.error("💡 Solution: Reinvite the bot with the 'applications.commands' scope");
            } else if (globalError.code === 20012) {
              console.error("🚫 Bot lacks permission to manage application commands");
              console.error("💡 Solution: Reinvite the bot with the 'applications.commands' scope");
            } else if (globalError.code === 50013) {
              console.error("🚫 Missing permissions in the server");
              console.error("💡 Solution: Make sure the bot has the 'Manage Server' permission");
            }
          }
        }

      } catch (error) {
        console.error("💥 Critical error in command registration:", error);
      }
    });

  } catch (error) {
    console.error("💥 Critical error in slash handler:", error);
  }
};