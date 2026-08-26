# ProMcBot implementation status

This status reflects the current default branch after the full prompt review and the bot/plugin/dashboard cleanup. It distinguishes code that is implemented from behavior that requires external credentials or a real production environment.

| Prompt area | Status | Evidence or limitation |
|---|---|---|
| Preserve bot, dashboard, backend, and MongoDB architecture | DONE | Existing architecture retained; targeted fixes are additive or remove proven-dead loaders |
| Canonical Discord command surface | DONE | Eight top-level groups from `bot/commands/commandCatalog.js`; one slash loader; duplicate detection smoke test |
| Legacy command migration | DONE | Old public names removed from registration, dead files removed, docs/translations updated |
| Discord permission enforcement | DONE | Runtime checks added before command execution; guild routes also require manager authorization |
| First-class Minecraft plugin | DONE | Java 21 Maven/Paper artifact with identity, HMAC, queue, heartbeat, and status command |
| Minimized telemetry | DONE | Join, leave, aggregate count, and heartbeat only; no chat or unnecessary player payloads |
| Asynchronous plugin communication | DONE | Network calls run from async Bukkit tasks; player reads run from sync task |
| Authentication and request signing | DONE | Provisioned bearer token plus encrypted secret, HMAC-SHA256, timestamp, nonce, and token hashing |
| Replay protection and limits | DONE | Nonce persistence/TTL, freshness window, request validation, body limits, and telemetry rate limit |
| Reconnect/retry/backoff | DONE/PARTIAL | Bounded retry and requeue are implemented; durable disk queue is not implemented |
| Offline-safe Minecraft operation | DONE | Gameplay does not depend on backend availability; `/promcbot status` reports degraded state |
| Activation/onboarding progress | DONE/PARTIAL | Activation endpoints and dashboard onboarding exist; real progression requires connected Discord/Minecraft data |
| Deterministic intelligence | DONE | Two-window evidence-backed activity, session, and returning-player calculations |
| Player journey/retention | PARTIAL | Foundations and returning-player signals exist; complete cohort/1-7-30 day reporting needs more longitudinal data |
| Weekly intelligence | DONE/PARTIAL | Weekly report foundation and automation trigger exist; only measured metrics are emitted |
| Impact tracking | PARTIAL | Automation evidence and before/after-capable metadata exist; full action outcome measurement is not complete |
| Automation | DONE/PARTIAL | Trigger, condition, cooldown, permission/entitlement gate, bounded retry, dedupe, audit execution, and Discord action exist; trigger catalog remains narrow |
| Alerts/notifications | DONE/PARTIAL | Severity, evidence metadata, dedupe, open/resolved lifecycle, read and resolve routes exist; external delivery depends on Discord configuration |
| Network intelligence | DONE/PARTIAL | Multi-instance identity and measured comparison exist; production-scale distributed analytics are not proven |
| Premium/entitlements | DONE/PARTIAL | Central Free/Pro/Ultimate authority and server-side gates exist; live payments require provider credentials |
| Dashboard responsive shell | DONE | Shared mobile-first CSS/JS fixes header/profile/sidebar/card overflow; 390×844 preview inspected |
| Real-data policy | DONE | Fake rank/server/player/subscription values removed from the rebuilt overview; empty states explain next action |
| Security boundaries | DONE/PARTIAL | Auth, ownership, permission, signed telemetry, replay, validation, rate limits, secure sessions, and safe errors are implemented; operational secret rotation remains required |
| MongoDB/data model | DONE/PARTIAL | Models and indexes support current query patterns; retention is TTL-based for selected event/report/notification data |
| Observability | DONE/PARTIAL | Health, startup warnings, queue state, telemetry status, and operational logs exist; external tracing/metrics are not included |
| Localization and vocabulary | DONE/PARTIAL | Help translations and command vocabulary updated; full audit of every legacy string across all surfaces remains a follow-up |
| Node/runtime compatibility | DONE | Docker and package engines use Node 22.13.0; obsolete Node 18 dependency removed |
| Paper/Spigot/Purpur/Fabric matrix | PARTIAL | Paper build is verified; real runtime matrix for forks is not included; Fabric is not supported |
| Payment verification | DONE/PARTIAL | Stripe-compatible signature boundary and entitlement processing exist; provider account/webhook credentials are external |

## Verification performed

The repository passes `npm test` with 13 passing tests, including entitlement, telemetry signature/replay, intelligence, automation dedupe, message rendering, and bounded retry coverage. The command registry smoke test loads eight groups and reports no duplicate canonical names. Bot startup smoke loads five events, eight slash groups, and three message commands without Discord or MongoDB credentials. Dashboard backend startup smoke passes in degraded mode and no longer crashes when OAuth credentials are absent. `npm run check`, JavaScript syntax checks, JSON parsing, and `git diff --check` pass. Maven `clean test package` passes, and the generated plugin JAR contains the required classes and `plugin.yml`.

Live Discord command registration, authenticated dashboard flows, real MongoDB persistence, plugin-to-backend telemetry acceptance, and payment-provider acceptance require external credentials and a running production-like environment. They are not marked as complete merely because the local code checks pass.
