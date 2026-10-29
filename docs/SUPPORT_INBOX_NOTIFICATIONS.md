# Support inbox notifications

The inbound support webhook stores each new message in the Admin Support Inbox and, when configured, sends an email notification to the admin recipients.

Set these server-side environment variables:

```env
BREVO_API_KEY=your-brevo-api-key
SUPPORT_INBOX_NOTIFICATION_EMAILS=admin@example.com,backup@example.com
PUBLIC_BASE_URL=https://promcbot.dev
```

`SUPPORT_INBOX_NOTIFICATION_EMAILS` accepts comma-, semicolon-, or whitespace-separated addresses and supports up to 50 recipients. `SUPPORT_INBOX_NOTIFICATION_EMAIL` is supported as a single-recipient alias for backwards-compatible deployments.

Notifications are sent only after a new inbound message is stored. Provider retries identified by the same `messageId` are treated as duplicates and do not send another notification. If the notification recipient is not configured or Brevo delivery fails, the message remains stored and the inbound webhook still completes; the delivery failure is logged for server-side troubleshooting.
