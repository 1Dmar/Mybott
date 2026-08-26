# ProMcBot Data Privacy

## Data collected

The first-party plugin sends server and instance identifiers, protocol/version health, aggregate online-player counts, and join/leave events containing a Minecraft UUID, username, timestamp, and measurable session seconds. The dashboard stores Discord guild/user session information already required for authentication. Telemetry payloads are bounded and do not include chat content, commands, IP addresses, or arbitrary server files.

## Why it is collected

The data supports connection health, player activity, session-duration measurement, retention/journey calculations, evidence-backed recommendations, weekly reports, and configured notifications. The server owner controls provisioning, instance credentials, rules, and revocation.

## Retention and access

Telemetry, automation executions, reports, and notifications currently use expiry fields between 90 and 180 days as defined in their models. Billing records are retained as required for account and transaction history; the exact legal retention period must be set with the payment provider and operator policy. Access is restricted by guild management checks, owner-protected observability, server/instance scope, and backend entitlement checks. Secrets are never returned from listing endpoints.

## Deletion and expiry

Revoking an instance stops future authenticated telemetry. MongoDB TTL removes telemetry and expiring operational records after their policy window. Subscription expiration removes paid feature access but does not immediately delete historical data. A future privacy administration workflow should add explicit export/delete requests and provider-specific legal retention controls.

Operators must configure privacy notices and consent/authorization appropriate to the Discord and Minecraft communities they operate. ProMcBot does not claim legal compliance merely from these code controls.
