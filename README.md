# Family Dashboard V2.3.1 — Shared Grocery

V2.3 turns Grocery into a shared family service instead of iPad-local state.

## What is new

- Shared Grocery state backed by Cloudflare D1.
- `/api/grocery` GET/POST API.
- iPad Grocery and Overview read/write the shared database.
- iPhone-first Grocery web app at `/grocery/`.
- iPhone app supports Shopping List and All Items views, search, and one-tap updates.
- New consistent inline SVG sidebar icons (no external icon library).
- Apple Home Screen icon and web-app metadata for Grocery.
- Automatic refresh every 10 seconds on iPad and iPhone.

## Cloudflare D1

`wrangler.jsonc` now declares a D1 binding named `DB`. On a Git-connected dashboard deployment, Cloudflare can automatically provision the D1 resource for this binding. The Worker creates the Grocery table and seeds the master list automatically on the first `/api/grocery` request.

If the deployment asks you to select/create a D1 database instead, create one named `family-dashboard-db` and bind it to the Worker with variable name `DB`.

## First checks after deploy

1. `/api/health` should report version `2.3`.
2. Open `/api/grocery` while authenticated. It should return the seeded Grocery items.
3. Open the main dashboard and toggle an item.
4. Open `/grocery/` on an iPhone. The same item should already be selected.
5. Toggle it on the iPhone and confirm the iPad updates within about 10 seconds.

## iPhone installation

Open `/grocery/` in Safari, then use Share → Add to Home Screen. The installed shortcut is named **Grocery** and uses the included basket icon.

The existing Cloudflare Access policy continues to protect the Worker and the Grocery app.


## V2.3.1 performance update

- Grocery taps now use optimistic UI: the green check changes immediately.
- D1 synchronization runs in the background.
- Failed writes roll the local state back.
- Silent refresh interval reduced to 5 seconds for faster cross-device synchronization.
