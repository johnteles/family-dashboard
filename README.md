# Family Dashboard V2.7

## Historical Import, Transaction Review & Bills

V2.7 extends the Finance Core with:

- editable imported transactions
- review status and preserved original description
- category + subcategory editing
- optional categorization rules created from transaction edits
- Bills: upcoming / paid / overdue, recurring monthly or yearly
- D1 schema migrations that preserve existing Finance data
- import metadata fields for future Open Finance providers

### Historical statements
The supplied Santander statements for May-August 2026 are used as the initial historical dataset design basis. The package includes a staging JSON file under `data/` with clearly identifiable transactions and review flags. It is intentionally **not auto-imported**: ambiguous PIX/transfers should be reviewed before becoming family expense/income data.

### Upgrade
Replace:
- `public/finances/index.html`
- `src/index.js`
- `README.md`

Add:
- `data/history_may_aug_2026_staging.json` (reference/staging only; do not expose as a public asset)

Existing Grocery, Calendar, Google OAuth, D1 data and secrets remain unchanged.
