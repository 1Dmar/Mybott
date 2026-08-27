# ProMcBot Billing

The current billing boundary uses PayPal and does not require Stripe. The domain models remain provider-neutral (`Subscription`, `Payment`, `Invoice`, and `BillingEvent`), while `bot/utils/billingService.js` contains the PayPal adapter for OAuth, subscription checkout, cancellation, webhook verification, and idempotent event processing.

Supported customer methods are PayPal, credit/debit card through provider-hosted checkout where enabled, and Google Pay through PayPal's supported provider capability where enabled in the target region/browser. ProMcBot never receives or stores raw card numbers, and a browser return URL never grants an entitlement.

Required optional variables are `PAYPAL_ENV`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_PRO_PLAN_ID`, `PAYPAL_ULTIMATE_PLAN_ID`, and `PUBLIC_BASE_URL`. Method flags are `PAYPAL_CARD_CHECKOUT_ENABLED` and `PAYPAL_GOOGLE_PAY_ENABLED`. The provider account must independently enable the relevant payment capability; environment flags alone do not prove that checkout is available.

The provider routes are `GET /api/billing/config`, `GET /api/guilds/:guildId/billing`, `POST /api/guilds/:guildId/billing/checkout`, `POST /api/guilds/:guildId/billing/cancel`, and `POST /api/billing/webhook/paypal`. Webhooks are verified from the raw body and PayPal transmission headers through PayPal's verification endpoint. `BillingEvent` uses provider/event identity for idempotency.

The local implementation is ready for PayPal sandbox configuration but has not been declared live-provider tested because credentials and plan IDs were not supplied. Before production, test checkout approval, verified webhook activation, renewal, cancellation, expiration, payment failure, duplicate webhook, replayed webhook, and out-of-order events where supported.
