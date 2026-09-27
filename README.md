# Family Dashboard V2.4.2 — Rebuilt performance update

Changes:
- Grocery Add Item closes immediately and saves in background (optimistic create).
- Grocery Remove confirmation closes immediately and deletes in background (optimistic delete).
- Grocery supports `+ NEW CATEGORY...` when adding or editing an item.
- Calendar MONTH / WEEK / DAY switches render immediately, then refresh data in the background.
- Existing shared Grocery, D1, Calendar, Weather, Cloudflare Access and iPhone UI remain intact.

Health endpoint: `/api/health` should report version `2.4.2`.
