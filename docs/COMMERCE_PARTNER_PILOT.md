# Commerce partner pilot — LigaGundam

The first commerce integration is intentionally scoped to a synchronized LigaGundam card listing. It is independent from market ranking: the existing lowest-price calculation stays unchanged, and the partner block is rendered separately in the card dossier.

## Current pilot

- Eligible offers are HTTPS listings on `ligagundam.com.br` only.
- A click goes through `/go/ligagundam`, which records an aggregate event and then redirects to the exact tracked listing.
- The event contains the partner, source code, public card/printing id, outbound page path, destination host and timestamp. It intentionally excludes account id, IP address, destination URL and purchase information.
- The visible label is `PILOTO DE OFERTA` by default. It must not be changed to `OFERTA PARCEIRA` until a commercial agreement is active.

## Activate an approved affiliate deeplink

Only after LigaGundam supplies and approves a deeplink format:

1. Set `LIGAGUNDAM_AFFILIATE_DEEPLINK_TEMPLATE` in the server environment. The template must contain exactly `{{destination}}`, which is replaced by the URL-encoded, validated LigaGundam listing URL.
2. Set `VITE_LIGAGUNDAM_PARTNER_STATUS=affiliate` for the site build, so the public disclosure changes to the affiliate wording.
3. Confirm the redirect preserves the exact card listing and verify one test click in the aggregate `partner_offer_clicks` table.

The deeplink template is a routing format, not a credential. Any API secret supplied by a partner must stay server-side and must never use a `VITE_` name.

## Measuring the pilot

Use the following SQL after the migration is applied:

```sql
SELECT partner_id, date(created_at) AS day, COUNT(*) AS clicks
FROM partner_offer_clicks
WHERE partner_id = 'ligagundam'
GROUP BY partner_id, date(created_at)
ORDER BY day DESC;
```

Clicks measure outbound intent only. Attribute sales and commission using the partner's approved reporting dashboard; do not infer revenue from click count alone.
