# Family Dashboard V2.0

V2 introduces the Family Hub navigation shell while preserving the working Google Calendar + Cloudflare backend.

## Screens
- Overview: real Google Calendar events + Grocery summary
- Calendar: real upcoming events
- Tasks: V2 shell placeholder
- Grocery: pre-built household grocery inventory with one-tap selection
- Meals: V2 shell placeholder
- Settings: V2 shell placeholder

## Grocery V2.0 behavior
The Grocery list is intentionally local-only in this first V2 shell and persists in the iPad browser via localStorage. This proves the wall interaction before a shared mobile sync provider/database is selected. Do not treat it as multi-device sync yet.

## iPad compatibility
No framework. Plain HTML/CSS/JavaScript, designed for iPad Air 1 / iOS 12.5.8.

## Backend
Existing Cloudflare Worker OAuth and Google Calendar secrets remain unchanged.
