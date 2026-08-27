# Payment system

ProMcBot uses a PayPal provider boundary. Stripe is not a required provider and no Stripe route or secret is used by the current billing service. The backend owns checkout creation, provider verification, subscription state, payment records, invoice records, and entitlement transitions.

| Payment method | Implementation | Current state |
|---|---|---|
| PayPal | PayPal OAuth, Billing Subscriptions checkout, approval URL, cancellation, webhook verification, idempotent event processing | Implemented in code; requires PayPal credentials and plan IDs |
| Credit/debit card | PayPal-hosted checkout method flag, with no raw card data handled by ProMcBot | Architecture implemented; requires PayPal card checkout enablement and regional/provider approval |
| Google Pay | Provider-mediated Google Pay method flag through PayPal's supported checkout capability | Architecture implemented; requires provider enablement, supported region/browser, credentials, and Google Pay approval |

The public API is `GET /api/billing/config`, authenticated `GET /api/billing/diagnostics`, `GET /api/guilds/:guildId/billing`, `POST /api/guilds/:guildId/billing/checkout`, `POST /api/guilds/:guildId/billing/cancel`, and `POST /api/billing/webhook/paypal`. Checkout accepts `plan` (`pro` or `ultimate`) and `method` (`paypal`, `card`, or `google_pay`). A method is disabled unless the required provider settings and at least one matching PayPal plan ID are present. The diagnostics endpoint checks OAuth and looks up each configured plan in the selected Sandbox or Live environment without returning credentials.

The browser never grants an entitlement. It receives a provider approval URL, and the subscription becomes active only after a verified PayPal webhook is accepted by the backend. Webhooks are checked using PayPal's transmission headers and the provider's `verify-webhook-signature` endpoint. Event IDs are stored in `BillingEvent` with a unique provider/event index, so duplicate events do not repeat state transitions.

Required variables are `PAYPAL_ENV`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_PRO_PLAN_ID`, `PAYPAL_ULTIMATE_PLAN_ID`, and `PUBLIC_BASE_URL`. Optional method flags are `PAYPAL_CARD_CHECKOUT_ENABLED` and `PAYPAL_GOOGLE_PAY_ENABLED`. The provider account must also be configured for the relevant methods; setting a flag alone does not prove availability.

The implementation is **not live-provider tested** in this repository because production credentials were not supplied. Sandbox testing should use PayPal sandbox credentials and sandbox plan IDs, then verify checkout, webhook, duplicate event, cancellation, renewal, failure, and expiration scenarios before production activation. Raw card numbers are never stored or accepted by this application.

When checkout fails, the backend now returns a safe provider explanation and optional PayPal debug ID instead of only `billing_checkout_failed`. The first checks are: `PAYPAL_ENV` matches the source of the Client ID, Secret, Plan IDs, and Webhook ID; the selected plan is Active/On in PayPal; `PAYPAL_PRO_PLAN_ID` is the Plan ID rather than the Product ID; the plan belongs to the same Sandbox or Live account; and the webhook URL is publicly reachable over HTTPS. A browser return to the Premium page never grants access by itself.

PayPal's official documentation describes its REST APIs for orders, payments, subscriptions, and related resources [1]. PayPal also documents Google Pay as a provider-mediated checkout capability with regional and account requirements [2].

## References

[1]: https://developer.paypal.com/api/rest "PayPal REST APIs"
[2]: https://developer.paypal.com/platforms/checkout/apm/google-pay "PayPal Google Pay integration"
