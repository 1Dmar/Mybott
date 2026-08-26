# ProMcBot Plugin Release

## Build

Run `mvn clean test package` from `plugin/` with JDK 21. The build runs JUnit tests, compiles against Paper API, and produces `target/promcbot-plugin-0.1.0.jar`.

## Verification

Before release, run `npm ci`, `npm test`, `npm run check`, `node --check` on changed JavaScript, `mvn clean test package`, `git diff --check`, and a runtime installation test on the declared server software. Generate a SHA-256 checksum with `sha256sum target/promcbot-plugin-0.1.0.jar` and publish it beside the artifact.

## Secrets and release metadata

The artifact contains no master secret. Runtime instance credentials belong in the server's untracked `config.yml`. Release metadata is the Maven version, `plugin.yml` version, protocol version, Java version, Paper API compile target, and checksum. Artifact signing/obfuscation is not claimed until a reproducible signing key workflow and runtime compatibility test are added.
