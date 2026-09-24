# Family Dashboard V1.3.1

Adds Google OAuth routes to the Cloudflare Worker.

## Routes
- `/api/health` backend health check (version 1.3.1)
- `/oauth/start` starts Google Calendar read-only OAuth
- `/oauth/callback` exchanges the authorization code and shows the refresh token once
- `/api/calendar` reads the next 14 days from the authenticated Google account primary calendar

## Required Cloudflare Secrets
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN` (added after completing `/oauth/start`)

Never commit credentials or tokens to GitHub.
