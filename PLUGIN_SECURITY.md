# Plugin Security

ProMcBot plugin credentials are provisioned per server/instance and are never embedded as master secrets in the JAR. The backend stores token hashes and AES-GCM encrypted signing secrets. Requests use HTTPS in production, bearer authentication, server/instance headers, protocol version, timestamp, nonce, and HMAC-SHA256 over the exact body.

The backend enforces replay windows, unique nonce TTL, constant-time comparisons, payload limits, rate limits, provisioning authorization, revocation, and server-side entitlement decisions. Critical business logic remains server-side. The artifact is not claimed impossible to reverse engineer; checksum/release verification is documented and compatible obfuscation/signing remains a future release-pipeline task.
