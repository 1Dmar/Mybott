# ProMcBot Network Intelligence

Ultimate network intelligence is represented by the `network.intelligence` and `network.analytics` feature keys. `PluginInstance` now supports guild, network, Minecraft-server, and instance identity, and the network engine compares measured online-player observations per instance, returning network health, measured server count, top/weakest measured server, and per-server status.

The `/api/guilds/:guildId/network` endpoint is Ultimate-gated and never infers cross-server player identity from usernames. It returns `Not enough data yet.` when no measured instance data exists. The current implementation supports the data-model boundary and deterministic comparison; network-wide retention, cross-server identity with consent, distributed operations, and production-scale benchmarks remain future work.
