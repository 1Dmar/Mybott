# Plugin Compatibility Research

## Official PaperMC context

Sources:

- [Paper plugin.yml documentation](https://docs.papermc.io/paper/dev/plugin-yml/)
- [Paper userdev documentation](https://docs.papermc.io/paper/dev/userdev/)

Paper documents that `api-version` communicates the API version a plugin targets and that modern Paper compatibility metadata has its own versioning rules. Paper userdev and NMS guidance also changes across Minecraft generations. Those documents are useful context, but they do not certify this repository's artifact on every server distribution or Minecraft version.

## Current repository implication

The current ProMcBot plugin intentionally avoids NMS and modern Paper-only APIs. It is compiled with Java 8 bytecode against `org.spigotmc:spigot-api:1.8.8-R0.1-SNAPSHOT`, and its `plugin.yml` has no modern `api-version` declaration. This supports a conservative Bukkit-compatible strategy, but it may cause a normal legacy-plugin warning on modern Paper.

The target acceptance matrix is Spigot/Paper/Bukkit-compatible 1.8.x, 1.12.x, 1.16.x, 1.20.x, and 1.21.x. Build evidence is verified; live load, connect, heartbeat, telemetry, retry, reconnect, outage, and shutdown behavior remains **IMPLEMENTED BUT UNVERIFIED** until a real server is exercised for each target combination. PocketMine-MP/Bedrock, Fabric, and Forge require separate implementations and are not claimed by this artifact.
