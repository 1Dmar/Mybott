# Entitlements

`bot/utils/entitlements.js` is the plan and feature authority. `bot/utils/entitlementService.js` reads the persisted subscription, applies expiration/status rules, and exposes feature checks and usage consumption. Dashboard locks, Discord handlers, automation, plugin capability responses, and payment transitions must use this authority rather than client-provided plan names.

| Plan | Price | Core value |
|---|---:|---|
| Free | $0/month | Discord/Minecraft connection, basic status, measured player activity, basic intelligence, basic alerts, onboarding, and useful weekly summaries within sensible limits |
| Pro | $4.99/month | Advanced retention, extended history, deeper analytics, advanced alerts and automation, richer reports, and growth intelligence |
| Ultimate | $9.99/month | Network intelligence, multi-server comparison, high-volume telemetry, network reports/alerts, advanced security monitoring, and operator controls |

A subscription can be active, trialing, past due, cancelled, expired, or in a grace period according to the stored provider state. Paid access is removed when the effective entitlement expires. A frontend redirect, button state, or user-provided plan value cannot grant paid access.

| Surface | Enforcement |
|---|---|
| Backend/API | `getForGuild`, `hasFeature`, and route-level feature gates |
| Dashboard | Server-returned entitlement and usage state; locked modules explain what/why/plan/CTA |
| Discord | Command handlers check the effective entitlement before advanced actions |
| Automation | Execution checks entitlement again so expired Pro rules do not continue silently |
| Plugin | Capability response is server-derived and the plugin remains a connector rather than the premium authority |
| Billing | Only a verified provider webhook can transition a paid subscription |

Limits are usage controls, not deceptive countdowns. Empty or locked states explain how a user can connect data or which genuine operational problem the paid capability solves.
