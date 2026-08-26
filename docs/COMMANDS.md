# ProMcBot command surface

This document describes the canonical Discord command surface after the command cleanup. Discord should expose eight top-level groups only: `server`, `minecraft`, `intelligence`, `moderation`, `premium`, `utility`, `admin`, and `help`. The registry is defined in `bot/commands/commandCatalog.js`; `bot/handlers/slash_handler.js` is the only slash registration path.

| Group | Supported subcommands | Permission model |
|---|---|---|
| `/server` | `setup`, `remove`, `logs`, `language`, `blacklist`, `mentions`, `bump`, `statusbar-setup`, `statusbar-update`, `statusbar-interval` | Manage Guild for the group; individual implementations may require Administrator |
| `/minecraft` | `players`, `player` | Manage Guild |
| `/intelligence` | `overview`, `health`, `journey`, `retention`, `network`, `report`, `actions` | Manage Guild; plan gates remain server-side |
| `/moderation` | `settings`, `filter`, `toggle`, `action`, `whitelist`, `log` | Manage Guild |
| `/premium` | `status` | Manage Guild |
| `/utility` | `ping`, `avatar`, `invite`, `support`, `playercard`, `stats` | Public utility group; renderer-dependent commands fail clearly when native canvas is unavailable |
| `/admin` | `eval`, `generate-code`, `subscriptions`, `subscription-codes`, `send-free-codes`, `delete-membership` | Administrator and owner checks remain implementation-specific |
| `/help` | Generated from the same catalog | Available through the canonical registry |

`/server setup` is the single onboarding entry point. `/minecraft players` and `/minecraft player` read measured join/leave telemetry; they do not call the removed legacy Minecraft API or invent a live player list. `/intelligence journey` is intentionally separate because it reports player-journey signals rather than a current player list.

The removed public names include `/setup_server`, `/remove_server`, `/automod-settings`, `/setlanguage`, the `mc-*` commands, and the separate API-key link/generate commands. Existing documentation and translations now point to the grouped names. The old source files that were proven unreferenced were removed instead of leaving a second loader that could re-register commands.

Registration is global and canonical. Guild-local stale commands are cleared by the loader before the global command set is synchronized. The loader also checks duplicate top-level names and loads the registry even in degraded mode, while disabling Discord synchronization when `BOT1_1_TOKEN` is absent. Permission checks are applied in `bot/events/interactionCreate.js` before execution, not only stored as descriptive metadata.

## Verification

The registry smoke test loads every implementation, reports eight top-level groups, detects duplicate names, and validates JavaScript syntax. The current Node test suite and bot startup smoke test must pass before a deployment is considered ready.
