# ProMcBot Entitlements

`bot/utils/entitlements.js` is the canonical plan definition. It contains the Free, Pro, and Ultimate catalog, exact prices, feature keys, history windows, and usage limits. `entitlementService.js` reads the normalized `Subscription` record and returns effective access, including cancellation, past-due grace, and expiration handling.

The backend APIs call this authority before advanced retention, network intelligence, and advanced bot/API features. The plugin requests signed capabilities from `/api/v1/plugin/capabilities`; it does not trust a client-provided plan. The Dashboard renders the catalog returned by the backend and cannot grant access by hiding or showing a button.

Representative feature keys include `server.intelligence.basic`, `server.intelligence.advanced`, `player.journey.basic`, `player.journey.advanced`, `retention.basic`, `retention.advanced`, `retention.cohort`, `automation.basic`, `automation.advanced`, `automation.campaigns`, `network.intelligence`, `network.analytics`, `security.basic`, `security.advanced`, `reports.basic`, `reports.advanced`, `reports.network`, `notifications.basic`, `notifications.advanced`, and `notifications.network`.

Usage is tracked by guild, UTC month, and feature in `UsageCounter`. The current limits are operational defaults, not a billing guarantee: Free automation 3, Pro 20, Ultimate 100; Free history 14 days, Pro 90 days, Ultimate 365 days. A production operator can adjust these constants only through a reviewed backend change.
