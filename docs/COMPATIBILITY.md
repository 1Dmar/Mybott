# Compatibility matrix

| Component | Supported baseline | Verified | Notes |
|---|---|---|---|
| Node.js | `>=22.13.0 <23` | Yes, syntax/startup/tests in Node 22 | Required by current `mongodb`, `minecraft-protocol`, and `mineflayer` dependency set |
| npm | Lockfile-compatible npm | Yes, `npm ci` | Railway uses `npm ci` in the Docker build |
| MongoDB | URI supplied through `MONGO_URL` or `MONGO_URI` | Schema/tests verified; live database requires credentials | `MONGO_URL_SECONDARY` is optional |
| Discord.js | Repository lockfile version | Registry/startup verified | Live command registration requires a valid bot token |
| Paper | API version declared in `plugin.yml` | Maven package verified | Runtime behavior still depends on the target server build |
| Spigot/Purpur | Paper-compatible API target | Not runtime-proven here | Validate on the target server distribution before production rollout |
| Fabric | Not supported by this Paper plugin artifact | No | A separate Fabric implementation would be required |
| Railway | Docker deployment from default branch | Previously verified for the service | Required environment variables must be present for full functionality |
| Dashboard server routes | `/myservers` plus authenticated `/servers` compatibility redirects | Local route/UI tests pass | Live OAuth acceptance still requires a real session; dynamic server pages are manager-only |

The plugin artifact is compiled with Java 21 and contains `plugin.yml`, the plugin main class, `BackendClient`, and `TelemetryQueue`. Maven `clean test package` passes in the repository environment. This is build compatibility evidence, not a claim that every Paper-compatible server fork has been runtime-tested.

The application starts in degraded mode when MongoDB, Discord OAuth, or the Discord bot token is absent. That mode is intentional for diagnostics: it keeps the process alive, loads the canonical command registry locally, and returns explicit configuration errors rather than crashing. Production still requires persistent MongoDB, OAuth credentials, and a bot token for the corresponding features.
