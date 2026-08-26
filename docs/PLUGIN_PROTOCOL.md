# ProMcBot Plugin Protocol v1

## Scope

This document describes the first implemented plugin-to-backend telemetry slice on the default branch. It is not a claim that every future intelligence, economy, event, or server-platform adapter exists.

## Provisioning

A guild manager requests `POST /api/guilds/:guildId/plugin/provision` with a valid dashboard session and an `instanceId` matching `[A-Za-z0-9._-]{3,64}`. The backend generates a random access token and signing secret, stores only the access-token hash and AES-GCM encrypted signing secret, and returns the plugin configuration once. The encryption key is supplied by the `PLUGIN_ENCRYPTION_KEY` environment variable and is never stored in the plugin artifact.

If `PLUGIN_ENCRYPTION_KEY` is missing, provisioning returns `503 plugin_provisioning_not_configured`. The credentials are not returned again by the backend; operators must store them in the server's local `plugin/config.yml` securely.

## Signed telemetry request

The plugin sends batched JSON to:

`POST /api/v1/telemetry/events`

Required headers are:

| Header | Meaning |
|---|---|
| `Authorization: Bearer <access-token>` | Provisioned instance credential. |
| `X-ProMcBot-Server` | Guild/server identity. |
| `X-ProMcBot-Instance` | Minecraft instance identity. |
| `X-ProMcBot-Version` | Protocol version, currently `1`. |
| `X-ProMcBot-Timestamp` | Unix timestamp in seconds. |
| `X-ProMcBot-Nonce` | Unique request nonce. |
| `X-ProMcBot-Signature` | HMAC-SHA256 of the canonical request. |

The canonical input is:

```text
<timestamp>\n<nonce>\n<exact raw JSON body>
```

The backend accepts timestamps within a five-minute replay window, verifies the access-token hash, decrypts the instance signing secret, compares the HMAC in constant time, and stores the nonce with a short TTL. A repeated nonce returns a replay error. Payloads are limited to 512 KiB at the HTTP/parser layer, 250 events per request, 32 data keys per event, and 512 characters per scalar string.

## Event minimization

The first plugin implementation sends `player_join`, `player_leave`, `player_count`, and `heartbeat`. UUID and username are sent only on join/leave events; periodic counts contain only an aggregate number. The backend stores telemetry for 90 days through an expiry field and indexes by server, instance, type, and occurrence time.

## Failure behavior

Network calls are performed by Java's asynchronous HTTP client from Bukkit async scheduler tasks. The plugin does not block the Minecraft main thread, and a bounded in-memory queue protects memory. If ProMcBot is unavailable, the Minecraft server remains playable; telemetry is delayed until the queue is flushed or discarded after the bounded queue is full. The plugin's local `/promcbot status` command reports queue size, dropped events, and last backend state.

## Compatibility statement

The artifact is compiled against Paper API `1.21.4-R0.1-SNAPSHOT` and declares `api-version: '1.20'`. This repository verifies compilation and unit tests, but does not claim runtime compatibility with a specific Paper, Spigot, Purpur, Fabric, or Minecraft server release until an integration test is run on that server software.
