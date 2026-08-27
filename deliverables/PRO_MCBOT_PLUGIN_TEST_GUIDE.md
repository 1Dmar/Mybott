# ProMcBot Universal Bukkit Plugin — Test Guide

## Artifact

Use `ProMcBot-0.1.0-Universal-Bukkit.jar` and place it in the `plugins/` directory of a Spigot or Paper server.

SHA-256:

```text
7d90f48e7dfba416f3287826bf336ea54d3834f6bb8f8a3234f287d2b78a658c
```

## Supported targets

The artifact is compiled to Java 8 bytecode against the shared Spigot/Bukkit 1.8.8 API. It is intended for:

| Server software | Target versions |
|---|---|
| Spigot | 1.8.x, 1.12.x, 1.16.x, 1.20.x, 1.21.x |
| Paper | 1.8.x, 1.12.x, 1.16.x, 1.20.x, 1.21.x |
| Bukkit API | Shared API layer used by the above Java server software |

The JAR intentionally has no modern `api-version` field so it can load on 1.8.x. Modern Paper may print a legacy-plugin warning; that warning is expected for this cross-version artifact. PocketMine-MP is not supported because it is a separate PHP/Bedrock platform, not a Bukkit Java server.

The repository verifies the Java 8 bytecode and descriptor, but a live runtime test is still required on every listed server target before claiming full runtime certification.

## Build and output

From the repository root:

```bash
npm run build:plugin
```

The build produces:

```text
plugin/target/promcbot-plugin-0.1.0.jar
```

The downloadable copy is:

```text
ProMcBot-0.1.0-Universal-Bukkit.jar
```

## Test steps

1. Start the selected Spigot or Paper server once and stop it.
2. Copy the JAR into `plugins/`.
3. Start the server again and confirm that ProMcBot loads without a class-version error.
4. Generate the one-time configuration from ProMcBot Dashboard: **My Servers → select the server → Setup & Intelligence → Generate one-time config**.
5. Add `PLUGIN_ENCRYPTION_KEY` to the Node/Dashboard deployment first. Without it, provisioning intentionally returns `plugin_provisioning_not_configured`.
6. Copy the generated values into `plugins/ProMcBot/config.yml`.
7. Restart the server.
8. Run `/promcbot status` in the server console or in-game.
9. Return to Dashboard and wait for a recent heartbeat. Player data and intelligence appear only after real plugin telemetry arrives.

## Important limitation

Minecraft IP and port settings are used by basic legacy status consumers. They do not replace the plugin and do not create player telemetry or remote command capability. A successful JAR build does not prove a live connection; the final acceptance test must be performed on an actual Spigot/Paper instance for each target version.
