# Family Dashboard — OAuth recovery diagnostic patch

Target: existing Worker V2.9.6. This package includes ONLY `src/index.js` and does not change Finances, D1, Grocery, or static UI.

## Deploy
Replace `src/index.js` in the GitHub repository, commit, and confirm Cloudflare Workers build succeeded.

## Test
1. In a new private window, open `https://family-dashboard.johnfteles.workers.dev/oauth/start`.
2. Complete Google consent once. Do not reload `/oauth/callback`, as authorization codes are single-use.
3. If successful, copy the refresh token directly into the `GOOGLE_REFRESH_TOKEN` Cloudflare Production Secret. Do not paste the token into chat or GitHub.
4. Test `/api/calendar`.
5. If `token_exchange` fails, share ONLY the JSON response body; it contains no OAuth code or secrets.

## Security
This is a minimal diagnostic patch. It does not rotate existing credentials or automatically persist the refresh token. Do not share browser callback URLs containing `code=`. Existing OAuth callback still displays the refresh token on success; treat the page as confidential.

The Cloudflare Access policy should continue protecting the Worker. Publishing the OAuth app does not remove the Google unverified-app warning; verification is a separate process.
