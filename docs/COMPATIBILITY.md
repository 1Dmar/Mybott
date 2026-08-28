# Compatibility

| Component | Supported baseline | Verified | Notes |
|---|---|---|---|
| Node.js | `>=22.13.0 <23` | Yes, syntax/startup/tests in Node 22 | Required by the current application dependency set |
| npm | Lockfile-compatible npm | Yes, `npm ci` | Railway uses the repository install path in the Docker build |
| MongoDB | URI supplied through `MONGO_URL` or `MONGO_URI` | Schema/tests verified; live database requires credentials | `MONGO_URL_SECONDARY` is optional |
| Discord.js | Repository lockfile version | Registry/startup verified | Live command registration requires a valid bot token |
| Spigot API baseline | `1.8.8-R0.1-SNAPSHOT` | Maven package verified | The plugin is compiled to Java 8 bytecode and uses Bukkit-compatible APIs |
| Spigot/Paper/Bukkit-compatible 1.8.x | Lowest-common-denominator API strategy | Build verified; live runtime pending | Install and exercise on the target server before production |
| Spigot/Paper/Bukkit-compatible 1.12.x | Lowest-common-denominator API strategy | Build verified; live runtime pending | Install and exercise on the target server before production |
| Spigot/Paper/Bukkit-compatible 1.16.x | Lowest-common-denominator API strategy | Build verified; live runtime pending | Install and exercise on the target server before production |
| Spigot/Paper/Bukkit-compatible 1.20.x | Lowest-common-denominator API strategy | Build verified; live runtime pending | Install and exercise on the target server before production |
| Spigot/Paper/Bukkit-compatible 1.21.x | Lowest-common-denominator API strategy | Build verified; live runtime pending | Install and exercise on the target server before production |
| PocketMine-MP/Bedrock | Not a Bukkit API target | No | A separate PHP/Bedrock adapter would be required |
| Fabric/Forge | Not a Bukkit API target | No | A separate implementation would be required |
| Railway | Docker deployment from the default branch | Previously verified for the service | Full functionality still requires the required environment variables |
| Dashboard server routes | `/myservers` plus authenticated compatibility redirects | Local route/UI tests pass | Live OAuth acceptance requires a real session; dynamic server pages are manager-only |

The current plugin artifact is compiled with **Java 8 bytecode** against the Spigot 1.8.8 API baseline. It contains `plugin.yml`, the plugin main class, `BackendClient`, `TelemetryEvent`, `TelemetryQueue`, and `TelemetrySpool`. Maven `clean test package` passes in the repository environment. This is build compatibility evidence, not a claim that every Paper-compatible server fork or Minecraft version has been runtime-tested.

The plugin does not declare a modern `api-version` in `plugin.yml`, so modern Paper may treat it as a legacy Bukkit plugin and emit its normal compatibility warning. Runtime acceptance must be recorded per server distribution and Minecraft version, including load, connect, heartbeat, telemetry, retry, reconnect, and shutdown behavior.

The application starts in degraded mode when MongoDB, Discord OAuth, or the Discord bot token is absent. That mode is intentional for diagnostics: it keeps the process alive and returns explicit configuration errors rather than claiming that external features are connected. Production still requires persistent MongoDB, OAuth credentials, and a bot token for the corresponding features.
