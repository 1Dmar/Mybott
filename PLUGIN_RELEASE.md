# ProMcBot Plugin Release

## Build

Run `npm run build:plugin` from the repository root, or `mvn clean test package` from `plugin/`, with JDK 8 or newer. The build runs JUnit tests, compiles against the Spigot/Bukkit 1.8.8 API using Java 8 bytecode, and produces `plugin/target/promcbot-plugin-0.1.0.jar` for Spigot/Paper 1.8.x, 1.12.x, 1.16.x, 1.20.x, and 1.21.x targets. Runtime acceptance still requires starting the artifact on each actual server target.

## Verification

Before release, run `npm ci`, `npm test`, `npm run check`, `node --check` on changed JavaScript, `mvn clean test package`, `git diff --check`, and a runtime installation test on the declared server software. Generate a SHA-256 checksum with `sha256sum plugin/target/promcbot-plugin-0.1.0.jar` and publish it beside the artifact.

## Secrets and release metadata

The artifact contains no master secret. Runtime instance credentials belong in the server's untracked `config.yml`. Release metadata is the Maven version, `plugin.yml` version, protocol version, Java target, Spigot/Bukkit compile target, supported server targets, and checksum. Artifact signing/obfuscation is not claimed until a reproducible signing key workflow and runtime compatibility test are added.
