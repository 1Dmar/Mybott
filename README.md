# ProMcBot

ProMcBot is a Discord bot, Minecraft/Paper plugin, and server-scoped operations dashboard for small Minecraft communities and larger networks. The project favors a small canonical command surface, measured telemetry, server-side entitlements, explicit degraded states, and safe failure over fake metrics, fake AI, or fake payment success.

## Current readiness

The default branch is `copilot/update-bot-design-and-translation-system`. Local code checks and builds pass, the Dashboard responsive preview passes across the supported QA widths, and the plugin artifact builds. The repository is **READY FOR REAL SERVER TESTING**. It is not certified as fully production-live until the external acceptance matrix is run with real Discord, MongoDB, OAuth, PayPal, and Paper environments.

## Runtime components

The Node.js runtime uses Node 22.13.0 and CommonJS modules. The Express dashboard and API use MongoDB/Mongoose when `MONGO_URL` or `MONGO_URI` is configured. The Discord runtime is created once and exposed to the dashboard lazily. The Paper plugin targets Java 21 and uses a bounded asynchronous telemetry queue with bearer authentication, HMAC signing, timestamp freshness, nonce replay protection, and encrypted provisioned secrets.

## Canonical Discord commands

The public slash surface is intentionally consolidated into eight groups: `/server`, `/minecraft`, `/intelligence`, `/moderation`, `/premium`, `/utility`, `/admin`, and `/help`. The source of truth is `bot/commands/commandCatalog.js`; `bot/handlers/slash_handler.js` is the only slash registration loader. New public commands must be added to the catalog and covered by acceptance tests before registration.

## Configuration boundary

Core operation requires a Discord bot token, MongoDB URL, owner ID, OAuth configuration, and session secret. Plugin provisioning additionally requires `PLUGIN_ENCRYPTION_KEY`. PayPal checkout remains disabled unless the PayPal client credentials, webhook ID, and both paid plan IDs are configured. Card checkout and Google Pay are provider-mediated flags; ProMcBot never stores raw card data and never grants an entitlement from a browser redirect.

Use `.env.example` or the environment configuration used by the deployment platform. Do not commit tokens, provider secrets, one-time plugin configurations, or session credentials. Previously exposed credentials must be rotated outside this repository.

## Development and verification

Install dependencies with `npm ci --ignore-scripts` in environments where the optional native renderer is unavailable. Run `npm test` for the deterministic Node suite and `npm run check` for entry-point syntax checks. Build the plugin with `cd plugin && mvn -q clean test package`. The optional `canvas` renderer has an explicit unavailable response when its native binary is not built; this does not prevent bot startup.

## Documentation map

The implementation and limitation matrix is in `docs/IMPLEMENTATION_STATUS.md`. Architecture, security, plugin protocol, compatibility, migration, Dashboard, commands, Premium, Payments, Entitlements, and Glossary documents are maintained under `docs/`. `PRO_MCBOT_FINAL_QA.md` records the latest verification boundary and external blockers. Do not interpret a local pass as live Discord, MongoDB, PayPal, or Paper acceptance.
