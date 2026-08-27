# Migration notes

The command cleanup is a public-surface migration, not a data-destructive migration. The canonical registry now exposes grouped commands while preserving the underlying supported behaviors where they are safe and evidence-backed.

| Legacy surface | Canonical replacement | Migration status |
|---|---|---|
| `/setup_server` and `/mc-setup` | `/server setup` | Removed from registration and documentation |
| `/remove_server` | `/server remove` | Removed from registration and documentation |
| `/setlanguage` | `/server language` | Removed from registration and documentation |
| `/automod-settings` and related top-level names | `/moderation settings` and related subcommands | Grouped and documented |
| `mc-info` / `mc-players` / `mc-player` | `/intelligence health`, `/minecraft players`, `/minecraft player` | Legacy API commands removed; telemetry-backed replacements are active |
| API-key link/generate commands | `/server setup` and dashboard provisioning | Removed from public registration because provisioning now uses signed credentials |

No MongoDB collection is dropped by this change. Existing `User`, `Server`, subscription, telemetry, plugin, report, audit, and notification records remain addressable by their existing identifiers. New `dedupeKey`, notification status, and resolution fields are additive and have defaults for older records.

The automation changes are also additive. Existing rules retain their trigger/action fields; executions gain a deduplication key and notifications gain an explicit open/resolved lifecycle. Operators should review any rule that used `weekly_summary`, because it now runs once per UTC week only when the comparison windows contain sufficient evidence.

The Dashboard route migration changes the user-facing server picker from `/servers` to `/myservers`. The former top-level and dynamic `/servers` paths remain authenticated compatibility redirects. The new picker and all current server selectors use the backend manager-only contract, so view-only Discord Guilds are not exposed as manageable workspaces. No MongoDB record is changed by this route migration.

The deployment migration requires Node.js 22.13.0 or newer within the supported major version range. The Docker image and package engines express this requirement, and the obsolete `node@18` runtime dependency has been removed. Railway should rebuild from the default branch after the commit is pushed.

Before applying future schema changes, take a database backup and validate indexes in a staging environment. This repository does not silently backfill or delete production data.
