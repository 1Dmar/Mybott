# Minecraft plugin

The Paper plugin is a Java 21 Maven artifact. It establishes server and instance identity from `config.yml`, receives a provisioned access token and signing secret, signs telemetry requests with HMAC-SHA256, and sends events asynchronously so network work never blocks the Minecraft primary thread.

The plugin records only operational signals required by the platform: player join, player leave with measured session duration, periodic aggregate online-player count, and heartbeat/queue health. A bounded in-memory queue protects the server thread when the backend is unavailable. Batches use a timeout and bounded exponential retry; a failed batch is requeued subject to the queue limit. Gameplay remains usable when telemetry is offline.

The only public Bukkit command is `/promcbot status`. It reports queue size, dropped event count, backend online/offline state, and capability availability. It never prints the access token or signing secret. The permission is `promcbot.status`, defaulting to true because the output is local health information rather than credential material.

Required configuration is under `backend`: `base-url`, `server-id`, `instance-id`, `access-token`, and `signing-secret`. `network-id`, `minecraft-server-id`, and `server-name` improve multi-server identity. The base URL must use HTTPS outside local development. The generated config contains empty placeholders and no production secrets.

Maven `clean test package` succeeds and the generated JAR contains `plugin.yml`, the plugin main class, `BackendClient`, and `TelemetryQueue`. Live installation acceptance still requires a real Paper server, valid provisioned credentials, a reachable backend, and observation that telemetry appears in the dashboard. Spigot/Purpur compatibility is expected only where their API behavior matches the declared Paper API; Fabric is not supported by this artifact.
