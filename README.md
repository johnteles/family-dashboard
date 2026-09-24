# Family Dashboard V1.4.1

V1.4 connects the wall dashboard to the real Google Calendar data.

## Expected Google calendars
- John
- Amanda
- Anthony
- Family

Calendar matching is case-insensitive and accent-insensitive. The Google account authorized by OAuth must have access to these calendars.

## Endpoints
- `/` live family dashboard
- `/api/health` backend health check (version 1.4)
- `/api/calendar` merged events from the four family calendars for the next 14 days

The dashboard refreshes calendar data every 5 minutes and keeps all Google credentials in Cloudflare Secrets.


## V1.4.1
Household-facing UI is now fully in English, and the shared calendar is named `Family`.
