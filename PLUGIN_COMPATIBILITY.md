# ProMcBot Plugin Compatibility Matrix

## Verified in this repository

| Item | Result | Evidence |
|---|---|---|
| Build tool | **VERIFIED** | `mvn -q -f plugin/pom.xml clean test package` |
| Compile API target | **VERIFIED** | Spigot/Bukkit API `1.8.8-R0.1-SNAPSHOT` in `plugin/pom.xml` |
| Bytecode | **VERIFIED** | Java major version `52`, equivalent to Java 8 bytecode |
| Descriptor | **VERIFIED** | `plugin.yml` has no modern-only `api-version` requirement |
| HTTP I/O | **IMPLEMENTED BUT UNVERIFIED** | Async `HttpURLConnection`, connect/read timeouts, bounded retry |
| Queue | **VERIFIED** | Bounded in-memory queue with dropped-event counter and unit tests |
| HMAC/timestamp/nonce | **VERIFIED LOCALLY** | Java security tests and backend protocol tests |
| Stable event identity | **VERIFIED LOCALLY** | `eventId` is preserved across retries; backend uses idempotent upsert |
| Graceful shutdown attempt | **IMPLEMENTED BUT UNVERIFIED** | Final non-blocking bounded flush attempt; live server shutdown not exercised |

## Target compatibility

The artifact targets Bukkit-compatible Java server software in these version families:

| Server software | Version family | Status | What is proven |
|---|---|---|---|
| Spigot | 1.8.x | **IMPLEMENTED BUT UNVERIFIED** | Compile against Bukkit/Spigot 1.8.8 API |
| Spigot | 1.12.x | **IMPLEMENTED BUT UNVERIFIED** | Uses conservative Bukkit APIs; external runtime required |
| Spigot | 1.16.x | **IMPLEMENTED BUT UNVERIFIED** | Uses conservative Bukkit APIs; external runtime required |
| Spigot | 1.20.x | **IMPLEMENTED BUT UNVERIFIED** | Uses conservative Bukkit APIs; external runtime required |
| Spigot | 1.21.x | **IMPLEMENTED BUT UNVERIFIED** | Uses conservative Bukkit APIs; external runtime required |
| Paper | 1.8.x–1.21.x | **IMPLEMENTED BUT UNVERIFIED** | Bukkit compatibility layer is targeted; each Paper runtime needs a live test |
| Bukkit-compatible forks | version-dependent | **IMPLEMENTED BUT UNVERIFIED** | Depends on API compatibility and Java runtime |
| PocketMine-MP / Bedrock PHP | Any | **NOT IMPLEMENTED** | Requires a separate PHP/Bedrock adapter and is intentionally out of scope |
| Fabric/Forge | Any | **NOT IMPLEMENTED** | Requires a separate adapter |

## Required runtime acceptance matrix

A version may be marked **TESTED** only after installing the exact artifact on a real server and recording the following:

| Server | Java version | Plugin loads | Heartbeat | Join/leave/count | Backend outage | Reconnect | Shutdown flush |
|---|---|---|---|---|---|---|---|
| Spigot 1.8.x | pending | pending | pending | pending | pending | pending | pending |
| Spigot 1.12.x | pending | pending | pending | pending | pending | pending | pending |
| Spigot 1.16.x | pending | pending | pending | pending | pending | pending | pending |
| Spigot 1.20.x | pending | pending | pending | pending | pending | pending | pending |
| Spigot 1.21.x | pending | pending | pending | pending | pending | pending | pending |
| Paper 1.8.x–1.21.x | pending | pending | pending | pending | pending | pending | pending |

The repository currently proves compile/package and deterministic tests. It does **not** claim that every listed server version has been run externally.
