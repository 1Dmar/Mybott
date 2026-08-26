# Security model

ProMcBot separates Discord authentication, guild authorization, plugin authentication, payment verification, and operational audit records. Dashboard routes require an authenticated Discord session, and guild-scoped routes use `requireGuildManager` before reading or mutating server data. Discord command permissions are checked at execution time in addition to the permissions declared in the canonical registry.

Plugin telemetry uses a provisioned bearer token plus an encrypted signing secret. The plugin signs `timestamp + newline + nonce + newline + body` with HMAC-SHA256. The backend validates the token hash, timestamp window, nonce uniqueness, request body limits, event limits, and a rate limit before accepting telemetry. Nonces are stored with TTL to provide replay protection. The plugin only sends aggregate player counts and join/leave identity fields required for operational analytics.

Payment webhook handling is separated from entitlement calculation. The webhook boundary verifies the provider signature and freshness before processing an event, and entitlement state is computed by the centralized authority. Real provider credentials and live payment acceptance remain external configuration requirements; no payment success is assumed from a client-side button.

Sessions use `connect-mongo` when `MONGO_URL` or `MONGO_URI` is configured. Without a Mongo URI, the backend starts with a clearly warned non-persistent memory session store for diagnostics and returns a configuration error for database initialization. Production must configure persistent MongoDB rather than relying on this degraded mode.

Automation and alerts use bounded retries, cooldowns, deduplication keys, explicit resolution status, and audit execution records. Notifications are scoped by guild, and the resolution endpoint applies the same guild-manager authorization as read operations. Error responses avoid returning credentials or raw secrets.

The repository contains no real production secrets. Railway, Discord, MongoDB, plugin provisioning, and payment credentials must be supplied through the deployment environment or the secure provisioning flow. Tokens shared conversationally should be revoked and rotated after use.

This document distinguishes implemented controls from operational requirements: the code provides the control boundaries, while production operators remain responsible for secret rotation, database backup, least-privilege deployment access, and reviewing provider logs.
