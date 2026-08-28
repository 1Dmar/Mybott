# Dashboard

The Dashboard is organized around the server a user can actually manage. The primary picker is `/myservers`; it consumes `/api/guilds`, whose response is explicitly scoped to Guilds where the authenticated Discord user is the Discord owner or has the Administrator permission. View-only Guilds are not rendered in the picker, Premium server selector, Intelligence setup selector, or Action Center source list. The former `/servers` and `/servers/:guildId/*` paths remain compatibility redirects to `/myservers` and `/myservers/:guildId/*`.

The shared shell in `dash/dashboard/shared.css` and `dash/dashboard/shared.js` is mobile-first and server-aware. Desktop shows an expanded navigation sidebar with Workspace and Server Control categories plus the selected server context. Phone widths start with a closed drawer and backdrop. The shell constrains the logo, avatar, profile, header, and cards so they cannot cover page content or introduce horizontal overflow.

| Surface | Behavior | Evidence state |
|---|---|---|
| `/myservers` | Compact search and server cards; only Owner/Administrator Guilds; permission badge per card | Backed by `getWorkspaceGuilds` and deterministic guild-access tests |
| Server overview | Four summary cards, live setup strip, four next-step rows, and four quick controls | Unified `/api/guilds/:guildId/overview` contract from Discord runtime, PluginInstance, TelemetryEvent, entitlement, and GuildSettings; missing values remain explicit |
| Setup & intelligence | Eight short activation rows, progress, connection evidence, one-time plugin provisioning, copyable Paper `config.yml`, and collapsed advanced modules | Activation evidence plus exact plugin config contract; generated secrets are one-time and not stored in the browser |
| Setup & settings | Prefix, language, optional address, and focused next-step guidance | Guild-manager protected settings API backed by persisted `GuildSettings` fields |
| Premium | Manager-only server selector, current plan, provider state, three concise plan cards, collapsed billing history | PayPal provider boundary; checkout disabled until configured |
| Modules | BotConfig-backed enable/disable controls for Discord features plus plugin connection status | `/api/guilds/:guildId/modules`; toggles persist to BotConfig and plugin status comes from PluginInstance |
| Audit logs | Compact audit records with result/source/actor/time | `/api/guilds/:guildId/audit` backed by AuditLog; empty activity is shown explicitly |
| Action Center | Evidence chips, advisory recommendations, notification read/resolve controls | Guild-scoped notification lifecycle; no fake executable action |
| Account home | Managed-server count, current plan, one focused CTA, sessions | `/api/guilds` filtered response and real session endpoint |

The design intentionally uses fewer, denser cards instead of long explanatory panels. Each card answers one operational question: **which server, what is its state, what should I do next, and where do I configure it?** Longer details are placed behind `details` disclosure where appropriate.

The visual reference supplied with the prompt exposed a stretched logo overlay, clipped avatar, profile/header overlap, uncontrolled sidebar, and excessive page density. The shared shell and rebuilt server pages address these defects. Local HTTP preview QA currently covers 63 page/viewport combinations across `/myservers`, server overview, setup, settings, Logs, Modules, Action Center, and Premium at 360, 390, 412, 768, 1024, 1280, and 1440 pixels. The measured result is no horizontal overflow, no page errors, and correct mobile drawer/backdrop behavior. This is deterministic fixture QA, not a replacement for live OAuth/browser acceptance.

A live authenticated browser test still requires a configured Discord OAuth session and real Discord Guild data. The server API filter is enforced on the backend as well as in the UI; opening a dynamic server URL without manager permission returns `403 guild_access_required` instead of relying on the picker to hide it.
