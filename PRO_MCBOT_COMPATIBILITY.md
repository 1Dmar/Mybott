# ProMcBot Plugin Compatibility

The current artifact is a Bukkit-compatible Minecraft plugin compiled with **Java 8 bytecode** against the `org.spigotmc:spigot-api:1.8.8-R0.1-SNAPSHOT` baseline. The implementation deliberately uses the lowest-common-denominator Bukkit/Spigot API rather than NMS or modern Paper-only APIs.

| Target | Build evidence | Runtime status |
|---|---|---|
| Spigot/Bukkit-compatible 1.8.x | Maven build and Java 8 bytecode verified | **IMPLEMENTED BUT UNVERIFIED** |
| Spigot/Paper/Bukkit-compatible 1.12.x | Lowest-common-denominator API strategy | **IMPLEMENTED BUT UNVERIFIED** |
| Spigot/Paper/Bukkit-compatible 1.16.x | Lowest-common-denominator API strategy | **IMPLEMENTED BUT UNVERIFIED** |
| Spigot/Paper/Bukkit-compatible 1.20.x | Lowest-common-denominator API strategy | **IMPLEMENTED BUT UNVERIFIED** |
| Spigot/Paper/Bukkit-compatible 1.21.x | Lowest-common-denominator API strategy | **IMPLEMENTED BUT UNVERIFIED** |
| PocketMine-MP/Bedrock | Not a Bukkit API target | **NOT IMPLEMENTED** |
| Fabric/Forge | Not a Bukkit API target | **NOT IMPLEMENTED** |

`plugin.yml` intentionally has no modern `api-version` declaration, so Paper may treat the plugin as a legacy Bukkit plugin and emit its normal compatibility warning. That metadata does not certify runtime support. Each target server distribution and Minecraft version must be installed and exercised before production acceptance.

The repository verifies Maven compilation, Java tests for the durable telemetry spool, plugin metadata, Java 8 bytecode, asynchronous backend transport, bounded retries, HMAC/timestamp/nonce handling, stable event IDs, and durable local recovery. This is build and deterministic-test evidence, not proof that every target runtime has been live-tested.

Build the artifact with:

```bash
cd plugin
mvn clean test package
```

The resulting file is `plugin/target/promcbot-plugin-0.1.0.jar`. The downloadable copy is `deliverables/ProMcBot-0.1.0-Universal-Bukkit.jar`.
