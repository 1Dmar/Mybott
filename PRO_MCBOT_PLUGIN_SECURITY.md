# ProMcBot Plugin Security

The plugin is an agent with no master secret in the JAR. Provisioning generates an access token and signing secret once; the backend stores only the token hash and AES-GCM encrypted signing secret using `PLUGIN_ENCRYPTION_KEY`. Production transport must use HTTPS.

Every telemetry/capability request carries server identity, instance identity, protocol version, timestamp, nonce, and HMAC-SHA256 over the exact request body. The backend enforces a five-minute replay window, unique nonce TTL, bearer-token hash comparison, constant-time signature comparison, body/event/key/string bounds, and rate limiting. Credentials can be rotated by provisioning again and revoked through the protected dashboard endpoint.

Critical business logic, subscription state, and capability decisions remain server-side. The JAR is compiled through Maven and has checksum/release documentation, but no artifact is claimed impossible to reverse engineer or tamper with. A future signed release pipeline can add artifact signing and compatible obfuscation after runtime compatibility tests.
