# Family Dashboard V2.4 — Grocery Item Management

Adds shared Grocery master-list management from the iPhone while keeping the wall iPad experience simple.

## New in V2.4
- `+ ADD ITEM` on the mobile Grocery app.
- Choose category when adding an item.
- `Add to Shopping List` enabled by default for new items.
- Duplicate-name prevention in D1 (case-insensitive).
- Long-press an item on iPhone to edit its name/category or delete it.
- New categories supported: Meat & Seafood, Drinks, Frozen, Personal Care, Baby & Kids.
- New items are stored in D1 and automatically appear on the wall iPad on its next refresh.
- Existing Grocery selection/sync behavior remains intact.

## Mobile Grocery
Open `/grocery/` on iPhone. Use **SHOPPING LIST** while shopping and **ALL ITEMS** to browse/manage the family master list.

## Deploy
Replace/add the files from this package in the existing GitHub repository and deploy normally through Cloudflare.

Health check: `/api/health` should report version `2.4`.
