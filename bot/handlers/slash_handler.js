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
          
          const commands = readdirSync(dirPath).filter(f => f.endsWith(".js"));
          
          for (const cmd of commands) {
            try {
              delete require.cache[require.resolve(path.join(dirPath, cmd))];
              const command = require(path.join(dirPath, cmd));
              
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

        console.log(`${client.emojis.LOADING} Starting command registration for client ${clientId}...`);

        // Get guild ID from environment
        const GUILD_ID = process.env.TEST_GUILD_ID || process.env.GuildID || "";
        
        // If we have a guild ID, try guild registration first
        if (GUILD_ID) {
          try {
            console.log(`${client.emojis.LOADING} Attempting guild command registration for guild ${GUILD_ID}...`);
            await rest.put(
              Routes.applicationGuildCommands(clientId, GUILD_ID),
              { body: allCommands }
            );
            console.log(`🏰 Successfully registered ${allCommands.length} GUILD slash commands for ${GUILD_ID}`);
            return; // Success - no need to try global
          } catch (guildError) {
            console.warn("⚠️ Guild registration failed:", guildError.message);
            
            // Check if it's an authorization error
            if (guildError.code === 50001 || 
                guildError.message?.includes('Unauthorized') || 
                guildError.message?.includes('Missing Access') ||
                guildError.message?.includes('not authorized')) {
              console.error("");
              console.error("╔════════════════════════════════════════════════════════════════╗");
              console.error("║  ${client.emojis.LOCK} MISSING ACCESS ERROR - ACTION REQUIRED!                    ║");
              console.error("╠════════════════════════════════════════════════════════════════╣");
              console.error("║  The bot needs to be re-invited with the correct permissions!  ║");
              console.error("║                                                                ║");
              console.error("║  1. Go to Discord Developer Portal:                            ║");
              console.error("║     https://discord.com/developers/applications                ║");
              console.error("║                                                                ║");
              console.error("║  2. Select your bot application                                ║");
              console.error("║                                                                ║");
              console.error("║  3. Go to OAuth2 → URL Generator                               ║");
              console.error("║                                                                ║");
              console.error("║  4. Select these SCOPES:                                       ║");
              console.error("║     ☑️ bot                                                     ║");
              console.error("║     ☑️ applications.commands                                   ║");
              console.error("║                                                                ║");
              console.error("║  5. Select these BOT PERMISSIONS:                              ║");
              console.error("║     ☑️ Administrator (or at least):                            ║");
              console.error("║        - Send Messages                                         ║");
              console.error("║        - Embed Links                                           ║");
              console.error("║        - Use Slash Commands                                    ║");
              console.error("║                                                                ║");
              console.error("║  6. Copy the generated URL and open it in your browser         ║");
              console.error("║                                                                ║");
              console.error("║  7. Select your server and authorize the bot                   ║");
              console.error("╚════════════════════════════════════════════════════════════════╝");
              console.error("");
              console.error(`${client.emojis.INFO} Quick invite link: https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot+applications.commands&permissions=8`);
              console.error("");
            }
          }
        }
        
        // Try global registration as fallback or primary
        console.log("⏳ Trying global registration...");
        
        try {
          await rest.put(
            Routes.applicationCommands(clientId),
            { body: allCommands }
          );
          console.log(`${client.emojis.EARTH} Successfully registered ${allCommands.length} GLOBAL slash commands`);
          console.log("⏳ Note: Global commands may take up to 1 hour to appear in all servers.");
        } catch (globalError) {
          console.error("❌ Global registration failed:", globalError.message);
          
          // Check for specific error codes
          if (globalError.code === 50001 || 
              globalError.message?.includes('Unauthorized') || 
              globalError.message?.includes('not authorized')) {
            console.error("");
            console.error("╔════════════════════════════════════════════════════════════════╗");
            console.error("║  ${client.emojis.LOCK} BOT TOKEN ERROR - ACTION REQUIRED!                         ║");
            console.error("╠════════════════════════════════════════════════════════════════╣");
            console.error("║  Your bot token may be invalid or expired!                     ║");
            console.error("║                                                                ║");
            console.error("║  1. Go to Discord Developer Portal:                            ║");
            console.error("║     https://discord.com/developers/applications                ║");
            console.error("║                                                                ║");
            console.error("║  2. Select your bot application                                ║");
            console.error("║                                                                ║");
            console.error("║  3. Go to Bot → Reset Token                                    ║");
            console.error("║                                                                ║");
            console.error("║  4. Copy the new token                                         ║");
            console.error("║                                                                ║");
            console.error("║  5. Update BOT1_1_TOKEN in Railway environment variables       ║");
            console.error("╚════════════════════════════════════════════════════════════════╝");
            console.error("");
          } else if (globalError.code === 50035 || globalError.message?.includes('Invalid Form Body')) {
            console.error("${client.emojis.EDIT} Invalid command format detected");
            console.error("${client.emojis.INFO} Solution: Check that all command names are lowercase and descriptions are valid");
          }
          
          console.log("${client.emojis.EDIT} Note: Commands are still loaded in memory and will work if previously registered.");
        }

      } catch (error) {
        console.error("💥 Critical error in command registration:", error);
      }
    });

  } catch (error) {
    console.error("💥 Critical error in slash handler:", error);
  }
};
