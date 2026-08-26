# ProMcBot Final QA Audit

## Delivery

The final implementation was committed and pushed to `copilot/update-bot-design-and-translation-system` at commit `598ae059d9c67d74e8d6f1f7466b6f2cd0d592ab`. The remote branch head matches this commit and the local working tree is clean.

## Verified successfully

| Check | Result |
|---|---|
| `npm ci --ignore-scripts` | Passed; clean install completed. |
| `npm test` | Passed; 9 tests, 0 failures. |
| `npm run check` | Passed; `server.js` and `dash/index.js` syntax valid. |
| Recursive `node --check` | Passed for all JavaScript under `bot`, `dash`, and `test`. |
| `git diff --check` | Passed. |
| `mvn clean test package` | Passed with JDK 21; plugin JAR produced. |
| Plugin checksum | Recorded in `plugin/SHA256SUMS`: `8fed60319af4b4edebaeecb91ef6be8475fb46fbc21eef7d3d94b57b857f10a7`. |
| Legacy `request` chain | Removed after deleting unused `get-image-colors`; clean install reports no dependency matching `request`. |

## Tests covered

The test suite checks Free/Pro/Ultimate feature boundaries, expiration fallback to Free, Stripe-compatible webhook signature verification, plugin request cryptography, insufficient intelligence behavior, evidence-backed activity decline, player journey/session duration, and measured network comparison.

## Remaining risk discovered by QA

`npm audit --omit=dev` reports 84 advisories in the existing dependency graph: 3 low, 45 moderate, 33 high, and 3 critical. The critical packages are `basic-ftp`, `fast-xml-parser`, and `tar`, and several fixes require transitive or major-version changes. They are recorded here rather than silently applying `npm audit fix --force`, which could break Discord/Minecraft image and browser integrations. Production deployment should isolate browser/image tooling, pin reviewed upgrades, and rerun the full test and runtime matrix after each dependency change.

The package declares Node 18 while this sandbox used Node 22.13.0; deployment should use the declared Node 18 runtime or update the engine only after compatibility testing. Plugin runtime support for actual Paper/Spigot/Purpur versions is not claimed because only Maven compile and unit tests were executed.

## Final QA findings fixed in this pass

The old premium-key API gate, `/claim` activation, owner code generation, static premium pricing/FAQ claims, UserProfile membership shortcut, and message-command membership gates were moved away from the new paid-access path. Global premium and Action Center routes were added, dashboard navigation was wired, billing callbacks require provider verification, action buttons are non-executable unless a real system is attached, and subscription expiration is checked inside automation execution as well as at creation time.
