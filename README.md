# Family Dashboard V2.5 — Finance Core

V2.5 adds a provider-independent financial foundation to the existing Family Hub.

## New finance model
- Accounts and cards
- Family transactions: income, expense, transfer
- Categories and custom categories
- Monthly and category budgets
- Categorization rules table
- Provider/source + external ID for deduplication
- Normalized JSON batch import endpoint for future CSV/OFX/Open Finance adapters
- Family ownership model, while retaining technical owner metadata for consent/reconciliation

## New endpoints
- `GET /api/finance/summary?month=YYYY-MM`
- `GET|POST /api/finance/transactions`
- `GET|POST /api/finance/categories`
- `GET|POST /api/finance/accounts`
- `GET|POST /api/finance/budgets`
- `POST /api/finance/import`

The first request to a finance endpoint creates the D1 tables and seeds default categories. No bank credentials or financial data are stored in GitHub.

## iPad
Tasks and Meals are removed from the sidebar for now. Finances is added as a read-only wall dashboard. Until transactions are imported, it intentionally shows an empty Finance Core state rather than fake values.

## Next
V2.6 will add the full iPhone `/finances/` experience and import UI. Open Finance will remain a replaceable provider adapter, not the source of truth.
