# ProMcBot Intelligence

The deterministic intelligence layer consumes real telemetry from MongoDB and compares equal recent and previous windows. Server intelligence currently covers average online players, activity trend, observed returning-player overlap, and measured session-duration trend. Player intelligence covers first seen, last seen, sessions, measurable session seconds, frequency over 30 days, return behavior, and deterministic segments: new, returning, active, loyal, declining, inactive.

Every result carries sample size, confidence, observation evidence, interpretation, and recommendations only when a threshold is met. With insufficient data the API and UI return `Not enough data yet.` No random metrics or fake AI output is generated. An AI interpretation provider is not configured in this phase; deterministic functionality continues independently.

The Action Center maps recommendations to actual systems. A recommendation without a wired action is explicitly marked non-executable rather than presented as a dead button.
