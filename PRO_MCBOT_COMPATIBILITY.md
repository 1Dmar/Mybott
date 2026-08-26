# ProMcBot Compatibility

The plugin is a Maven project compiled against Paper API `1.21.4-R0.1-SNAPSHOT` with Java 21 and `api-version: '1.20'`. The repository verifies Maven compilation, Java unit tests, plugin metadata, HMAC behavior, and bounded queue behavior.

The project does not claim runtime compatibility with a specific Paper, Spigot, Purpur, Fabric, or Minecraft server release until the artifact is installed and exercised on that server software. Fabric is not a Bukkit/Paper API target for this plugin; a Fabric adapter would be a separate implementation.

The exact verification command is:

```bash
cd plugin
mvn clean test package
```

A future compatibility matrix should record server software, Minecraft version, Java version, plugin version, join/leave telemetry, heartbeat, reconnect, and shutdown behavior for every tested combination.
