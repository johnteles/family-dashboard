# Family Dashboard V1.3

V1.3 converts the project from static-only assets to a Cloudflare Worker plus Static Assets.

## Structure
- `public/index.html`: existing iPad-compatible dashboard
- `src/index.js`: Worker backend
- `wrangler.jsonc`: Cloudflare Worker + Assets configuration
- `package.json`: Wrangler dependency and scripts

## Test endpoints
- `/` -> dashboard
- `/api/health` -> backend health check
- `/api/calendar` -> Calendar scaffold; returns 503 until Google secrets are configured

Do not commit Google credentials or refresh tokens to GitHub. Add them later as Cloudflare Secrets.
