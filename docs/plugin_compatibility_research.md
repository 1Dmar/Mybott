# Plugin compatibility research notes

## Official PaperMC findings (2026-08-27)

Source: https://docs.papermc.io/paper/dev/plugin-yml/

Paper's `plugin.yml` documentation states that `api-version` identifies the Paper API version used by a plugin and that servers with a lower version than the declared value refuse to load it. The documentation lists valid versions from 1.13 through 26.2 and explains that minor versions are supported from 1.20.5 onward. A plugin without `api-version` is treated as a legacy plugin with a console warning.

Source: https://docs.papermc.io/paper/dev/userdev/

Paper's userdev documentation explains that the supported tooling and mappings changed for modern versions. It specifically notes removal of obfuscations from Minecraft 26.1 onward and that Paper no longer supports obfuscated plugins from that point. This means a single build strategy must not assume one modern NMS/mapping approach works across 1.8.x and 26.x.

## Implementation implication

The current plugin is compiled with Java 21 against Paper API 1.21.4 and declares `api-version: 1.20`. A truthful compatibility plan must either use a lowest-common-denominator Bukkit API/reflection strategy with Java-8-compatible bytecode, or publish separate artifacts for legacy Java 8/1.8.x and modern Java 21/1.21+ servers. A single current Java-21 JAR cannot run on a Java-8 1.8.x server. Paper/Spigot/Bukkit runtime acceptance must be tested on actual server versions; declaration alone is not proof of compatibility.
