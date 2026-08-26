# ProMcBot Automation

Automation rules are guild-scoped and stored in `AutomationRule`; every attempt is stored in `AutomationExecution`. The implemented trigger is evidence-backed activity decline, with a weekly-summary enum reserved for the report path. A rule has an enable switch, threshold, action, Discord channel, cooldown, creator, and bounded message template.

The engine reads the same intelligence records as the Dashboard, checks confidence and threshold before acting, disables destructive Minecraft actions by not exposing a control channel, applies cooldowns, disables delivery when a channel is unavailable, and emits a notification for executed or failed delivery. The five-minute process-local scheduler is appropriate only for the current single-process deployment; distributed locking is required before horizontal scaling.

Campaign creation, admin alerts, report generation as an action, inactivity triggers, event participation triggers, and server-milestone triggers remain explicit extension points rather than fake buttons.
