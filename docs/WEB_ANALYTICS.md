# Web analytics

The site uses Cloudflare Web Analytics for aggregate traffic and real-user performance measurement.

## Activation

1. In Cloudflare Web Analytics, add `tcgtd.com.br` and copy its site token.
2. Set the hosted runtime value `CLOUDFLARE_WEB_ANALYTICS_TOKEN` through Sites.
3. Publish the validated version.

The deployment Worker injects the beacon only when the hosted token is present. Local Vite previews never receive the script. Cloudflare's beacon automatically follows this application's History API route changes.

## Privacy and security

- The integration does not add cookies or persistent browser identifiers.
- Local previews never send analytics traffic.
- The Content Security Policy permits only Cloudflare's beacon origin and ingestion endpoint.
- The public privacy page documents the aggregate audience and performance measurement.

Cloudflare Web Analytics does not currently support custom product events. If funnels or feature-level behavior become necessary, evaluate a separate product analytics tool instead of encoding personal data into URLs.
