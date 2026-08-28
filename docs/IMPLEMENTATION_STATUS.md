# ProMcBot implementation status

This status reflects the current default branch after the final-master review and the iterative bot/plugin/dashboard cleanup. It separates implemented code from behavior that requires external credentials, a real runtime, or longitudinal production data.

| Prompt area | Status | Evidence or limitation |
|---|---|---|
| Preserve bot, dashboard, backend, and MongoDB architecture | DONE | Existing architecture retained; changes are additive or remove proven-dead loaders/listeners after reference checks |
| Canonical Discord command surface | DONE | Eight top-level groups from `bot/commands/commandCatalog.js`; one slash loader; durable acceptance tests cover names, descriptions, permission metadata, and help parity |
| Legacy command migration | DONE | Old public names removed from registration; dead loaders/commands removed only after reference checks |
| Discord permission enforcement | DONE | Runtime checks precede command execution; guild routes require manager authorization |
| First-class Minecraft plugin | DONE / IMPLEMENTED BUT UNVERIFIED | Java 8 Maven/Bukkit-compatible artifact with identity, signed requests, bounded durable spool, heartbeat, capability refresh, and `/promcbot status`; live version matrix remains external |
| Minimized telemetry | DONE | Join, leave, aggregate count, and heartbeat only; no chat or unnecessary player payloads |
| Asynchronous plugin communication | DONE | Network calls run from async Bukkit tasks; player reads run from sync task |
| Authentication and request signing | DONE | Provisioned bearer token plus encrypted secret, HMAC-SHA256, timestamp, nonce, and one-way token hashing |
| Replay protection and limits | DONE | Nonce persistence/TTL, freshness window, body limit, payload shaping, and telemetry rate limit; deterministic tests cover malformed headers, oversized payload, invalid signature, and replay |
| Reconnect/retry/backoff | DONE/PARTIAL | Bounded retry/requeue and durable local spool are implemented; real Paper/Spigot reconnect and shutdown runtime tests remain external |
| Offline-safe Minecraft operation | DONE | Gameplay does not depend on backend availability; `/promcbot status` reports degraded state |
| Activation/onboarding progress | DONE/PARTIAL | Backend now exposes eight evidence-bearing steps; dashboard renders status and next action; real progression requires connected Discord/Minecraft data |
| Deterministic intelligence | DONE | Two-window evidence-backed activity, session, and returning-player calculations; insufficient data is explicit |
| Player journey/retention | PARTIAL | Foundations and returning-player signals exist; complete cohort/1-7-30 day reporting needs longitudinal data |
| Weekly intelligence | DONE/PARTIAL | Weekly report foundation and automation trigger exist; only measured metrics are emitted |
| Impact tracking | PARTIAL | Automation execution evidence and before/after-capable metadata exist; output does not claim causality and full outcome measurement is not complete |
| Automation | DONE/PARTIAL | Trigger, condition, cooldown, permission/entitlement gate, bounded retry, dedupe, audit execution, Discord action, local overlap guard, and Mongo lease exist; scheduler wake-up remains process-local |
| Alerts/notifications | DONE/PARTIAL | Severity, evidence metadata, dedupe, open/resolved lifecycle, read and resolve routes exist; external delivery depends on Discord configuration |
| Action Center UI | DONE/PARTIAL | Rich evidence/why/recommendation/severity/status cards, notification read/resolve controls, loading/error/empty states, and shared responsive shell are implemented; recommendations remain advisory |
| Network intelligence | DONE/PARTIAL | Multi-instance identity and measured comparison exist; production-scale distributed analytics are not proven |
| Premium/entitlements | DONE/PARTIAL | Central Free/Pro/Ultimate authority and server-side gates exist; live payments require provider configuration |
| Payment boundary | DONE/PARTIAL | PayPal OAuth/subscription/cancellation/webhook verification and provider method metadata exist; PayPal sandbox/live acceptance was not possible without credentials; Stripe is not used |
| Dashboard responsive shell | DONE | Shared mobile-first CSS/JS fixes header/profile/sidebar/card overflow; Actions, Intelligence, and Premium were exercised at 360/390/412/768/1024/1280/1440 in a production-like HTTP preview |
| Real-data policy | DONE | Fake rank/server/player/subscription values removed from rebuilt overview and intelligence surfaces; empty states explain what is missing |
| Security boundaries | DONE/PARTIAL | Auth, ownership, permission, signed telemetry, replay, validation, rate limits, secure sessions, and safe errors are implemented; operational secret rotation remains required |
| MongoDB/data model | DONE/PARTIAL | Models and indexes support current query patterns; selected telemetry/report/notification data uses TTL; real production persistence was not exercised here |
| Observability | DONE/PARTIAL | Health, startup warnings, operation/correlation IDs, queue state, telemetry status, and operational logs exist; external tracing/metrics are not included |
| Localization and vocabulary | DONE/PARTIAL | Help translations and command vocabulary were updated; full audit of every legacy string across every historical surface remains a follow-up |
| Node/runtime compatibility | DONE | Docker and package engines use Node 22.13.0; obsolete Node 18 dependency removed |
| Paper/Spigot/Bukkit-compatible/Fabric matrix | PARTIAL | Spigot 1.8.8 API baseline and Java 8 build are verified; target runtime matrix is not live-certified; Fabric is not supported |

## Verification performed

The repository passes `npm test` with **119 passing tests and 0 failures**, including entitlement boundaries, PayPal catalog/event mapping and fail-closed verification, telemetry signature/replay/security/idempotency paths, intelligence, automation dedupe and lock behavior, message rendering, public-profile template and image policy, address validation, tenant guards, bounded concurrency, and bounded retry coverage. The command acceptance suite verifies eight canonical groups, no duplicate top-level names, descriptions, permission metadata, and help registration parity. `npm run check`, changed-module JavaScript syntax checks, `git diff --check`, and secret/provider scans pass. The native `canvas` module is optional in this sandbox; renderer-dependent commands now fail explicitly and safely without startup noise.

The responsive preview tested **21 page/viewport combinations** across Actions, Intelligence, and Premium. All had `scrollWidth <= innerWidth`, no page errors, and the mobile drawer opened with its backdrop at widths up to 768px. This is static/authenticated-fixture QA, not a substitute for a real OAuth session.

Maven `clean test package` passes for the plugin and produces a Java 8 bytecode JAR containing the declared entry point, `plugin.yml`, `BackendClient`, `TelemetryEvent`, `TelemetryQueue`, `TelemetrySpool`, and `TelemetrySpoolWriter`. Live Discord command registration and REST fetch, authenticated Dashboard flows, real MongoDB persistence, plugin-to-backend telemetry on Paper, and PayPal sandbox/live checkout/webhooks require external credentials and runtime environments. They are not marked complete merely because local code checks pass.
