# ProMcBot Billing

The billing architecture is provider-abstract at the domain boundary and currently has a Stripe-compatible adapter boundary. MongoDB stores `Subscription`, `Payment`, `Invoice`, and idempotent `BillingEvent` records. Supported subscription states are `active`, `trialing`, `past_due`, `cancelled`, `expired`, and `grace_period`, with renewal, cancellation, period-end, and grace-period fields.

The browser cannot mark a server paid. Checkout is created server-side and requires `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, and `STRIPE_ULTIMATE_PRICE_ID`. The provider webhook at `/api/billing/webhook/stripe` verifies the exact raw body with `STRIPE_WEBHOOK_SECRET`, enforces a five-minute signature window, deduplicates event IDs, then updates subscription/payment/invoice state. The implementation does not claim that billing is live until those credentials and a configured Stripe account exist.

Required optional variables are `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_ULTIMATE_PRICE_ID`, and `PUBLIC_BASE_URL`. Cancellation is sent to the provider and the local subscription records `will_cancel`; expiry falls back to Free while data retention continues.
