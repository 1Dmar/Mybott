# ProMcBot Current State

## Working foundation to preserve

The repository contains a Discord.js bot, an Express dashboard, Mongoose models, Discord OAuth, existing moderation/welcome/log/ticket/community systems, and a Railway/Docker deployment path. The canonical slash-command loader and responsive dashboard navigation are preserved and cleaned. Duplicate loaders/listeners were removed only after reference checks. The transformation adds platform capabilities while protecting working systems.

## Current implemented platform slice

The default branch now contains a Paper API Maven plugin, minimized asynchronous telemetry, server/instance identity, bearer plus HMAC request authentication, timestamp and nonce replay protection, encrypted backend credentials, telemetry TTL, deterministic server and player intelligence, activation/onboarding routes, a central Free/Pro/Ultimate entitlement service, billing models and verified webhook boundary, premium center APIs/UI, automation rules and execution audit, weekly report generation, notification records, Action Center, and owner-protected observability.

## Partial or blocked areas

Full player cohort retention, cross-server identity analytics, distributed scheduling, a PayPal provider account, runtime Minecraft compatibility testing, AI interpretation, enterprise network operations, and durable multi-process queues require additional production infrastructure or credentials. These are represented as explicit partial or blocked states rather than fake success states.

## Placeholder or fake behavior found and removed/refactored

The legacy `/bot` API returned echo-style player, command, and status responses and independently trusted an `X-Premium-Key`; it now reports measured player/status data, uses central entitlements, and returns a clear not-implemented response for Minecraft command execution. The old `/claim` flow generated premium keys and wrote free-form membership strings; it now directs administrators to the server-side premium center without changing subscription state. The old premium page contained outdated prices, payment claims, trial claims, and static feature promises; it now reads backend plan metadata, displays PayPal/card/Google Pay availability, and disables checkout when the provider is not configured. The dashboard's hardcoded API key and global rank were removed.

## Duplicated logic and remaining refactor targets

Legacy premium models and utilities remain in the repository for migration compatibility, but new authorization must use `entitlementService`. The dashboard still contains older feature pages and some historical models that should be migrated gradually. The current process-local five-minute automation loop should be replaced by a distributed-safe worker before horizontal production scaling.

## Required environment variables

Core operation requires `BOT1_1_TOKEN`, `MONGO_URL` or `MONGO_URI`, `OWNER_ID`, OAuth values, and `SESSION_SECRET`. Plugin provisioning requires `PLUGIN_ENCRYPTION_KEY`. Real PayPal billing requires `PAYPAL_ENV`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_PRO_PLAN_ID`, `PAYPAL_ULTIMATE_PLAN_ID`, and optionally `PAYPAL_CARD_CHECKOUT_ENABLED`, `PAYPAL_GOOGLE_PAY_ENABLED`, and `PUBLIC_BASE_URL`.

## Source of truth

`Subscription` plus `entitlements.js` and `entitlementService.js` are the source of truth for plan and feature access. Telemetry and reports are server/guild/instance scoped. The browser never grants premium access, and the plugin never decides its own plan.
