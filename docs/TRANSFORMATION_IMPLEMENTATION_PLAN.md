# ProMcBot Transformation Implementation Plan

## Scope

This implementation is applied only to the default branch `copilot/update-bot-design-and-translation-system`. Existing Discord bot, dashboard, Express, MongoDB, OAuth, and REST behavior are preserved unless a change is required for the new platform foundation.

## Product loop

The first implementation slice turns the product loop into executable foundations:

`CONNECT → UNDERSTAND → DETECT → EXPLAIN → RECOMMEND → ACT → MEASURE → LEARN`

The loop is implemented conservatively. The plugin supplies minimized Minecraft telemetry; the backend authenticates and stores it; deterministic intelligence computes only evidence-backed comparisons; the dashboard exposes activation and intelligence; automation rules are explicit, rate-limited, auditable, and disableable.

## Delivery slices

1. **Minecraft plugin:** Maven/Paper-compatible first-party plugin with asynchronous batched telemetry, instance identity, heartbeat, reconnect/backoff, offline-safe local queue, and no main-thread network calls.
2. **Secure plugin protocol:** bearer credential plus timestamp/nonce/HMAC request signing, replay window, payload limits, server and instance identity, and backend validation.
3. **Telemetry data layer:** guild/server-scoped telemetry events and plugin-instance health models with indexes and retention fields.
4. **Activation:** evidence-backed setup progress and onboarding endpoint/page. Progress is derived from bot, Discord, Mongo, plugin, and telemetry state; it is never fabricated.
5. **Intelligence:** deterministic activity, returning-player, new-player, and session-duration signals where sample size is sufficient; each result distinguishes observation, analysis, evidence, and recommendation.
6. **Automation:** CRUD for explicit rules and a safe low-activity notification action with cooldown, audit record, permission metadata, and disable switch.
7. **Observability and entitlement foundation:** plugin health endpoint, readiness information, feature entitlement definitions for a free-first product, and a clear statement that payment processing is not implemented.
8. **Verification:** Node syntax checks, unit tests for pure security/analytics helpers, Maven build, and repository status/diff review.

## Non-goals in this slice

No claim is made that all future analytics, AI judgment, economy integrations, server-platform adapters, payment processing, or enterprise multi-region operation are complete. Those remain explicitly marked in implementation status documentation until real code and tests exist.
