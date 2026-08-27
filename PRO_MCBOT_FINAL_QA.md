# ProMcBot final QA

## Repository state

The verified code is on `copilot/update-bot-design-and-translation-system`, the requested default branch for this repository. Code verification completed at `2808734ca329c79d5fe34c76c764d857e31b3ee7`; later commits are documentation-only. `main` is not modified.

## Verified successfully

| Check | Result |
|---|---|
| `npm ci --ignore-scripts` | Passed |
| `npm test` | Passed: 24 tests, 0 failures after the final hardening pass |
| `npm run check` | Passed |
| Recursive JavaScript syntax checks | Passed for changed bot/dashboard/test modules |
| `git diff --check` | Passed in the final quality gate |
| `mvn clean test package` | Passed with Java 21; plugin JAR produced |
| Command registry smoke | Passed: 8 groups, no duplicate canonical names |
| Bot startup smoke | Passed: 5 events, 8 slash groups, 3 message commands without external secrets |
| Dashboard backend startup smoke | Passed in explicit degraded mode |
| Dashboard mobile preview | Passed at 390×844 for containment and no horizontal overflow |
| PayPal provider catalog tests | Passed; no Stripe provider is reported |
| PayPal mapping/fail-closed tests | Passed |

## What the current tests cover

The suite covers centralized Free/Pro/Ultimate boundaries, expiration fallback, PayPal catalog and subscription-event mapping, fail-closed webhook configuration, plugin request cryptography, intelligence confidence and measured trends, player journey/session calculations, network comparison, command automation dedupe, message rendering, and bounded retry behavior.

The command acceptance test loads the canonical catalog and every referenced implementation. It verifies the eight top-level groups, permission metadata, help parity, and catches duplicate canonical names. The bot startup smoke verifies that the process loads handlers without Discord or MongoDB credentials. The Dashboard preview checks the screenshot defects through a production-like static HTTP preview rather than treating a `file://` render as proof.

## Payment QA position

Stripe is not part of the current payment boundary. PayPal OAuth, hosted subscription checkout, PayPal webhook verification, cancellation, provider/event idempotency, and method availability metadata for PayPal, card checkout, and Google Pay are implemented. Live or sandbox provider acceptance was not performed because PayPal credentials and plan IDs were not supplied. No payment is marked successful by a browser redirect, and no entitlement is granted from frontend state.

## Remaining blockers and limitations

Live Discord registration and execution require a valid bot token and a test guild. Authenticated Dashboard and MongoDB persistence require OAuth and database credentials. Plugin-to-backend acceptance requires a real Paper server and provisioned credentials. PayPal, card, and Google Pay acceptance requires a configured PayPal sandbox or live account, plan IDs, webhook ID, method enablement, and regional support.

The dependency audit still reports advisories in the existing dependency tree. No forced upgrade was applied because it could break Discord, Minecraft, or browser integrations. Complete 1/7/30-day cohort retention, causal impact attribution, distributed scheduling, durable multi-process queues, and runtime compatibility across every Paper fork remain partial and are documented as such.

## Final QA position

The repository is **READY FOR REAL SERVER TESTING**, not certified as fully production-live. Local tests and builds pass, the screenshot defects were addressed in the tested preview, the command surface is consolidated, and payment code fails closed without configuration. The remaining external acceptance items are genuine environment requirements rather than hidden failures.
