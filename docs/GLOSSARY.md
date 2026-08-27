# ProMcBot product glossary

This glossary is the shared vocabulary for the Dashboard, Discord Bot, Backend, and Minecraft Plugin. A term should not be renamed on another surface unless the distinction is intentional and documented.

| Canonical term | Meaning | Avoid using |
|---|---|---|
| Server Intelligence | Evidence-backed operational signals for one Minecraft server | Server Stats when the feature includes recommendations |
| Network Intelligence | Measured comparison across multiple server instances | Network Stats as a replacement name |
| Action Center | Place where evidence-backed issues, recommendations, executions, and resolutions are reviewed | Tasks or generic AI actions |
| Automation | A configured trigger, condition, action, cooldown, retry, permission, and audit flow | Bot magic or background task |
| Alert | A severity-bearing operational signal with evidence and a resolution lifecycle | Notification when it requires operator attention |
| Notification | A delivered user-facing message that may be informational or operational | Alert when there is no issue state |
| Telemetry | Authenticated, signed, validated Minecraft operational events | Tracking or spying |
| Server identity | Stable logical identity used across Discord, backend, Dashboard, and plugin | Guild-only identity |
| Instance identity | Identity of one Minecraft runtime within a server or network | Server identity when multiple instances exist |
| Installation identity | Provisioned plugin installation record and credentials | API key when referring to signed plugin credentials |
| Free | The $0 plan with useful small-server capabilities and sensible limits | Demo or Elite Free |
| Pro | The $4.99/month plan for deeper retention, analytics, and automation | Premium when the exact plan matters |
| Ultimate | The $9.99/month plan for network-scale intelligence and controls | Enterprise unless a separate plan exists |
| Observed change | A measured difference after a timestamp or action | Caused by unless causal methodology exists |
| Evidence-backed | Supported by stored, measured data with sample and confidence context | AI-generated when the result is deterministic |
| Provider approval | Payment provider confirmation flow before entitlement activation | Payment success from a browser redirect |

The same vocabulary should appear in command descriptions, empty states, plan cards, alert messages, audit records, plugin status output, and documentation. Product copy should prefer an operational explanation and a next step over a generic “No data” message.
