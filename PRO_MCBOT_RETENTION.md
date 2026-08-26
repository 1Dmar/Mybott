# ProMcBot Retention

Retention analytics are derived from actual `player_join` and `player_leave` events. The player engine computes new players in the recent seven-day window, returning-player overlap, seven-day cohort retention, session count, last-seen time, measurable session duration, active-day frequency, and a segment for each observed UUID.

The API restricts the history window using the effective entitlement: 14 days for Free, 90 days for Pro, and 365 days for Ultimate. A cohort or return rate is only shown when the corresponding denominator exists; otherwise the response contains null values and `Not enough data yet.` The system does not claim 30-day retention until the necessary cohort window and events are present.

Cross-server identity is intentionally not inferred from usernames alone. A network identity model and privacy policy are required before sharing a player identity across instances.
