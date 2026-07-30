const { Collection } = require("discord.js");
const { readdirSync, existsSync, statSync } = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

// Only load dotenv in development
if (process.env.NODE_ENV !== "production") {
  require("dotenv-flow").config();
}

module.exports = async (client) => {
  try {
    // ── 1. Verify token ──────────────────────────────────────────────────────
    if (!process.env.BOT1_1_TOKEN) {
      console.error("❌ ERROR: BOT1_1_TOKEN is not defined in environment variables!");
      console.error("ℹ️  Solution: Add BOT1_1_TOKEN to your Railway environment variables.");
      return;
    }

    client.scommands = new Collection();

    /** @type {Map<string, object>} Use a Map to guarantee uniqueness by name */
    const commandMap = new Map();

    // ── 2. Load commands from folder ─────────────────────────────────────────
    const loadCommands = () => {
      try {
        const slashPath = path.join(__dirname, "..", "Commands", "Slash");

        if (!existsSync(slashPath)) {
          console.warn("⚠️  Slash commands directory not found:", slashPath);
          return;
        }

        for (const dir of readdirSync(slashPath)) {
          const dirPath = path.join(slashPath, dir);
          if (!statSync(dirPath).isDirectory()) continue;

          for (const cmd of readdirSync(dirPath)) {
            try {
              const fullPath = path.join(dirPath, cmd);
              if (statSync(fullPath).isDirectory()) continue;
              if (!cmd.endsWith(".js")) continue;          // skip non-JS files

              // Clear cache so hot-reloads work correctly
              delete require.cache[require.resolve(fullPath)];
              const command = require(fullPath);

              if (!command?.name || !command?.description || !command?.run) {
                console.warn(
                  `${client.emojis?.WARNING ?? "⚠️"}  Command "${cmd}" is missing required fields (name / description / run) — skipped`
                );
                continue;
              }

              // ── Duplicate detection ───────────────────────────────────────
              if (commandMap.has(command.name)) {
                console.warn(
                  `${client.emojis?.WARNING ?? "⚠️"}  Duplicate command name detected: "${command.name}" (from ${cmd}) — keeping first loaded copy`
                );
                continue;
              }

              const payload = {
                name:                    command.name,
                description:             command.description,
                options:                 command.options ?? [],
                default_member_permissions:
                  command.userPermissions?.bitfield?.toString() ?? null,
              };

              commandMap.set(command.name, payload);
              client.scommands.set(command.name, command);

              console.log(
                `${client.emojis?.SUCCESS ?? "✅"} Loaded command: ${command.name}`
              );
            } catch (cmdError) {
              console.error(
                `${client.emojis?.ERROR ?? "❌"} Error loading command "${cmd}":`,
                cmdError.message
              );
            }
          }
        }

        console.log(
          `${client.emojis?.SUCCESS ?? "✅"} Total loaded: ${client.scommands.size} unique slash commands`
        );
      } catch (error) {
        console.error("❌ Error loading commands:", error.message);
      }
    };

    loadCommands();

    // Final deduplicated array (Map already guarantees uniqueness)
    const allCommands = [...commandMap.values()];

    if (allCommands.length === 0) {
      console.warn("⚠️  No valid slash commands were loaded — skipping registration.");
      return;
    }

    // ── 3. Register commands when bot is ready ───────────────────────────────
    client.once("ready", async () => {
      try {
        if (!client.user?.id) {
          throw new Error("Client user not available after ready event");
        }

        const rest     = new REST({ version: "10" }).setToken(process.env.BOT1_1_TOKEN);
        const clientId = client.user.id;

        console.log(`\n⏳ Starting command registration for client ${clientId}...`);
        console.log(`📋 Commands to register (${allCommands.length}): ${allCommands.map(c => c.name).join(", ")}`);

        // ── 3a. Guild registration (instant, per-guild) ──────────────────────
        const guilds = await client.guilds.fetch();
        console.log(`\n🏰 Attempting guild command registration for ${guilds.size} guilds...`);

        let guildSuccess = 0;
        let guildFail    = 0;

        for (const [guildId, guild] of guilds) {
          try {
            await rest.put(
              Routes.applicationGuildCommands(clientId, guildId),
              { body: allCommands }
            );
            console.log(`✅ Registered ${allCommands.length} commands → ${guild.name} (${guildId})`);
            guildSuccess++;
          } catch (guildError) {
            console.warn(
              `⚠️  Failed to register commands for guild ${guildId}: ${guildError.message}`
            );
            guildFail++;
          }
        }

        console.log(
          `\n📊 Guild registration summary: ${guildSuccess} succeeded, ${guildFail} failed out of ${guilds.size} total`
        );

        // ── 3b. Global registration (propagates within ~1 hour) ──────────────
        console.log("\n🌍 Starting global command registration...");
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
