# ProMcBot Minecraft Plugin

The plugin is a first-party, Bukkit-API-compatible telemetry bridge for Java Minecraft servers. It collects minimized join/leave/session/count/heartbeat signals and sends them asynchronously in signed batches to the ProMcBot backend. It is intentionally offline-safe: Minecraft gameplay does not depend on the ProMcBot network being available.

## Supported server targets

This artifact is compiled to Java 8 bytecode against the Spigot/Bukkit 1.8.8 API and uses only the shared Bukkit API surface. It is intended for the following server families and test targets:

| Server software | Target versions | Artifact status |
|---|---|---|
| Spigot | 1.8.x, 1.12.x, 1.16.x, 1.20.x, 1.21.x | Java/API-compatible build; live runtime acceptance still requires each server target |
| Paper | 1.8.x, 1.12.x, 1.16.x, 1.20.x, 1.21.x | Java/API-compatible build; live runtime acceptance still requires each server target |
| Bukkit API | Shared API used by the above servers | Compile target is Spigot/Bukkit 1.8.8 |

“Bukkit” here refers to the API compatibility layer used by Bukkit-compatible Java servers. PocketMine-MP is a separate PHP/Bedrock platform and is not supported by this JAR.

The descriptor intentionally omits the modern `api-version` field so that 1.8.x servers can load it. Modern Paper may print a legacy-plugin warning; that warning is expected for this cross-version artifact. The repository cannot honestly claim live acceptance on every listed release until the JAR is started on each actual server runtime.

## Build

Requirements: JDK 8 or newer and Maven 3.8 or newer. JDK 21 can build the Java 8 target.

From the repository root:

```bash
npm run build:plugin
```

Or directly:

```bash
cd plugin
mvn clean test package
sha256sum target/promcbot-plugin-0.1.0.jar
```

The final artifact is created at:

```text
plugin/target/promcbot-plugin-0.1.0.jar
```

`original-promcbot-plugin-0.1.0.jar` is Maven Shade's intermediate copy; use `promcbot-plugin-0.1.0.jar` for installation.

## Provisioning

1. Configure `PLUGIN_ENCRYPTION_KEY` on the ProMcBot backend.
2. Log in to the dashboard as a guild manager.
3. Open **My Servers**, select the Discord server, and open **Setup & Intelligence**.
4. Generate one-time credentials for a unique instance ID.
5. Copy the returned values into the plugin's `config.yml` under `backend`.
6. Optionally set `network-id`, `minecraft-server-id`, and `server-name` when the instance belongs to a network.
7. Install `plugin/target/promcbot-plugin-0.1.0.jar` into the server's `plugins` directory and restart the server.
8. Verify `/promcbot status`, the signed capabilities refresh, and dashboard activation progress.

Never commit a configured `config.yml`, access token, or signing secret. The plugin artifact contains no master secret. Provisioned backend secrets are hashed or encrypted at rest.

## Data behavior

The plugin queues events in memory and flushes at most the configured batch size every five seconds. Player UUID and username are sent for join/leave events; periodic count snapshots contain only an aggregate count. The backend enforces request authentication, HMAC signatures, timestamps, nonce replay protection, payload bounds, and a 90-day telemetry expiry policy.

The plugin requests capability metadata from the backend on enable. The backend determines the effective plan and returns signed-request-protected results. A failed capability refresh degrades safely and never stops the Minecraft server.

## Configuration

`backend.base-url` must use HTTPS outside localhost. `server-id` identifies the Discord guild/server, `instance-id` identifies the Minecraft instance, `network-id` groups instances for Ultimate network intelligence, `minecraft-server-id` identifies the logical Minecraft server, and `server-name` is display metadata. `access-token` authenticates the instance, `signing-secret` signs request bodies, and `protocol-version` negotiates protocol behavior. `telemetry.batch-size`, `max-queue-size`, and `snapshot-seconds` control batching and the local bounded queue.
