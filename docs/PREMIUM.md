# Premium Center

The Premium Center presents the effective server-side plan, subscription status, renewal state, usage, limits, payment records, and provider availability. It distinguishes Free, Pro, and Ultimate by the operational problem each plan solves rather than hiding core value behind an artificial wall.

| Plan | What it solves | Main capabilities |
|---|---|---|
| Free | Gives a small server useful first value | Basic connection, status, measured player activity, basic intelligence, alerts, onboarding, and weekly summary within limits |
| Pro — $4.99/month | Saves time for a growing server | Extended history, retention, advanced analytics, advanced alerts/automation, richer reports, and growth signals |
| Ultimate — $9.99/month | Supports multi-server operations | Network overview, instance health, distribution, network trends, network reports/alerts, high-volume telemetry, and advanced operator visibility |

Every locked module should answer four questions: what it does, why the server needs it, which plan unlocks it, and how to upgrade. The Dashboard uses server-returned entitlement state for locks, while Discord and automation apply their own backend checks. Hiding a button in the browser is not treated as security.

The current checkout path uses PayPal as the provider boundary. PayPal, credit/debit card checkout, and Google Pay appear as distinct methods only when the provider account, plan IDs, regional support, and corresponding configuration are present. No raw card data is accepted or stored. A browser return URL never marks a subscription paid; only a verified provider webhook changes entitlement state.

The current Premium Center is ready for sandbox/provider configuration, not live payment claims. Operators must configure PayPal credentials, plan IDs, webhook ID, provider method enablement, and the public callback URL before checkout buttons become active.
