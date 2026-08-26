# ProMcBot dashboard

The dashboard uses the shared shell in `dash/dashboard/shared.css` and `dash/dashboard/shared.js`. The shell is designed mobile-first: navigation collapses into a controlled rail/drawer, a backdrop closes the drawer, profile controls stay inside the header, and cards use a single-column layout at phone widths before expanding on larger screens.

The overview page intentionally shows an empty state when the account has no connected guild or measured telemetry. It does not display fabricated server counts, rankings, player totals, or subscription state. A user is guided to `/intelligence` to connect Minecraft and receive measured signals. The plan label uses the centralized Free/Pro/Ultimate vocabulary rather than the ambiguous `Elite Free` label.

| Surface | Behavior | Evidence state |
|---|---|---|
| Profile header | Contained banner, bounded avatar, non-overlapping user controls | Verified in a 390×844 preview |
| Navigation | Mobile toggle, backdrop, close-on-route behavior | Implemented in shared shell |
| Overview cards | One-column phone stack and flexible desktop grid | Verified without horizontal overflow in preview |
| Server Intelligence | Evidence-first copy and onboarding link | No metric appears before telemetry exists |
| Active Sessions | Loading/error/empty states rather than invented values | Implemented in page script |
| Premium Center | Reads server-side entitlement and usage | Requires authenticated backend and provider configuration for payments |

The visual reference supplied with the prompt showed a clipped avatar, a profile/header overlap, an oversized dark sidebar, and horizontal layout failure. The new shared styles remove those failure modes in the tested static preview. A live authenticated browser acceptance test still requires a configured Discord OAuth session and real browser viewport checks at 360, 390, 768, 1024, and 1440 pixels.

The temporary preview used for visual QA is not an alternate production page. It only served the real dashboard HTML and CSS without authentication redirect so layout could be inspected deterministically; no preview data is used by the application.
