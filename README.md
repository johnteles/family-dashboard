# Family Dashboard V2.6.1 — Finances for iPhone

V2.6.1 builds the first full mobile finance experience on top of the provider-independent Finance Core introduced in V2.5.

## New mobile app
Open `/finances/` on iPhone. It includes:
- Overview: income, expenses, balance, budget usage, spending by category
- Transactions: search, add, edit and delete manual transactions
- Budgets: family monthly budget and category management
- Accounts: family accounts/cards with technical consent-owner metadata
- Add to Home Screen support with a dedicated icon and web manifest

## Finance philosophy
The UI is Family-wide. `owner` exists only as technical metadata for future Open Finance consent management. Internal transfers are supported as a distinct transaction type and do not count as family income or expense.

## API additions
V2.6.1 adds transaction update support to `/api/finance/transactions` while retaining all V2.5 endpoints.

## Deploy
Replace/add:
- `public/finances/index.html`
- `public/finances/manifest.webmanifest`
- `public/finances/apple-touch-icon.png`
- `src/index.js`
- `README.md`

No new Cloudflare secrets or bindings are required.


## V2.6.1 compatibility fix
- Legacy-safe month handling for older Safari/iOS.
- Removed String.padStart dependency.
- Added visible startup error fallback instead of a blank screen.
