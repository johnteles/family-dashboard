# Family Dashboard V2.1

V2.1 refines the wall-iPad experience while preserving the V2 navigation shell.

## Changes
- Overview: current Rio de Janeiro weather and temperature centered between date and clock.
- Weather is fetched server-side from Open-Meteo through `/api/weather` and refreshed every 10 minutes.
- Grocery: four categories fit in one horizontal row on the iPad.
- Grocery: selected items use a green check and subtle green highlight.
- Calendar, Google OAuth, Grocery local persistence, sidebar, auto-return, Tasks and Meals behavior remain unchanged.

## Endpoints
- `/api/health` -> version 2.1
- `/api/calendar` -> family Google Calendar events
- `/api/weather` -> current weather summary

Weather data: Open-Meteo (CC BY 4.0), https://open-meteo.com/
