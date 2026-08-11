# TCG Tactical Database — Public Alpha 01

Release date: 2026-08-10

## Alpha contract

- Public by direct link, deliberately excluded from search indexing.
- Browsing, database, meta, deck analysis and local deck storage remain free.
- Hosted identity is optional for general browsing and required only where a protected remote action needs it.
- Decks remain in the browser during Alpha 01; cloud deck sync is not promised by this release.
- Billing is not implemented.
- Alpha feedback is persisted in D1 and does not store the sender IP.

## Free-tier shape

- Static React/Vite frontend and Worker API on the current Sites deployment.
- D1 binding `DB` for pilot identities, provider-neutral subscriptions and feedback.
- Remote Forge AI requires a server-side `forge.remote_ai` entitlement even when a provider key is configured. The local Forge remains available.
- No analytics or advertising tracker is enabled by this release.

The current build must stay below the applicable Workers static asset limits. Validate file count and largest file before every release.

## Access model

| Tier | Alpha behavior |
| --- | --- |
| `free` | Default account and all public product surfaces |
| `supporter` | Prepared for remote Forge entitlement |
| `newtype` | Prepared for Forge and advanced intelligence entitlements |
| `master` | Same technical entitlement envelope as Newtype until benefits are formally published |

Entitlements are resolved server-side from `subscriptions`; UI labels are not authorization.

## Patreon activation gate

Patreon must remain an optional entitlement provider, not the only way to enter the application. Activation requires:

1. A published Patreon creator campaign with named benefits.
2. A Patreon API v2 OAuth client and exact hosted callback URL.
3. Campaign and tier IDs mapped to `supporter`, `newtype` and `master`.
4. Client secret and webhook secret stored only as hosted secrets.
5. Updated privacy and commercial terms before billing-linked functionality is exposed.
6. OAuth callback, token refresh, revocation and webhook tests.

The placeholders in `.env.example` document the required secret names. They do not activate or simulate Patreon.

## Release gate

1. Run the complete automated test suite.
2. Run the production build and confirm all static files remain within platform limits.
3. Validate the D1 migration on an empty SQLite database.
4. Deploy a private candidate and verify deployment status.
5. Obtain explicit approval before changing access from private/custom to public.
6. After opening, verify `/api/health`, submit one feedback report and inspect mobile/desktop critical paths.

## Rollback

- Restore access to private/custom immediately for an identity, rights, data or availability incident.
- Re-deploy the previous successful site version for a release regression.
- Disable optional remote Forge provider secrets if cost or abuse telemetry is abnormal.
- Never enable `FORGE_AI_ALLOW_FREE` publicly without an explicit usage budget and durable rate limiting.

## Primary platform references

- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare static asset billing and limits: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- Cloudflare D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- Patreon API v2: https://docs.patreon.com/
- Patreon creator fees: https://support.patreon.com/hc/en-us/articles/11111747095181-Creator-fees-overview
