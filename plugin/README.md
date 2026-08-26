# ProMcBot Minecraft Plugin

The plugin is a first-party, Paper-API-based telemetry bridge. It collects minimized join/leave/session/count/heartbeat signals and sends them asynchronously in signed batches to the ProMcBot backend. It is intentionally offline-safe: Minecraft gameplay does not depend on the ProMcBot network being available.

## Build

Requirements: JDK 21 and Maven 3.8 or newer.

```bash
cd plugin
mvn clean test package
```

The build produces `target/promcbot-plugin-0.1.0.jar`. The repository verifies compilation and unit tests only; it does not claim runtime support for a particular Paper, Spigot, Purpur, Fabric, or Minecraft release until an integration test is run on that server software.

## Provisioning

1. Configure `PLUGIN_ENCRYPTION_KEY` on the ProMcBot backend.
2. Log in to the dashboard as a guild manager.
3. Open `/intelligence` or `/onboarding`.
4. Select the Discord server and generate one-time credentials for a unique instance ID.
5. Copy the returned values into the plugin's `config.yml` under `backend`.
6. Install the generated JAR into the server's `plugins` directory and restart the server.
7. Verify `/promcbot status` and the dashboard activation progress.

Never commit a configured `config.yml`, access token, or signing secret. The plugin artifact contains no master secret. Provisioned backend secrets are hashed or encrypted at rest.

## Data behavior

The plugin queues events in memory and flushes at most the configured batch size every five seconds. Player UUID and username are sent for join/leave events; periodic count snapshots contain only an aggregate count. The backend enforces request authentication, HMAC signatures, timestamps, nonce replay protection, payload bounds, and a 90-day telemetry expiry policy.

## Configuration

`backend.base-url` must use HTTPS outside localhost. `server-id` identifies the Discord guild/server, `instance-id` identifies the Minecraft instance, `access-token` authenticates the instance, `signing-secret` signs request bodies, and `protocol-version` negotiates protocol behavior. `telemetry.batch-size`, `max-queue-size`, and `snapshot-seconds` control batching and retention in the local bounded queue.
