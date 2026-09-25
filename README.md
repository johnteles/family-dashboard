# Family Dashboard V2.2

V2.2 refines the wall-dashboard UX while preserving the existing Google Calendar, Cloudflare Access and weather integrations.

## Changes

- Home header is hardened for iPad Air / iOS 12 so the date stays on one line.
- Home content is now a three-column overview: **Today**, **Upcoming**, and **Grocery**.
- Grocery keeps the four-column quick-add layout and green selected state from V2.1.
- Calendar is redesigned around **Month / Week / Day** views.
- Month is the default calendar view.
- Previous / Today / Next navigation is included.
- Tapping a day in Month view opens that date in Day view.
- Calendar API accepts optional `start` and `end` query parameters (capped at 93 days) so Month view can request the correct date range.

No Google OAuth secrets or refresh tokens belong in this repository.
