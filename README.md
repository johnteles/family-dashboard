# Family Dashboard V2.9.2 - Credit Card Intelligence

V2.9.2 extends the Finance Core to consolidate bank statements and detailed credit-card statements without double counting.

## New in V2.9.2
- Finance transaction Context: `Family` or `3D Printing`
- Account kind supports `credit_card`; Santander Mastercard is seeded automatically
- Transaction kinds: purchase, refund/credit, credit-card payment, transfer
- Installment metadata (`current / total`)
- Merchant metadata separate from category
- Activity filters: All / Family / 3D Printing
- Overview cards for Family Expenses and 3D Printing expenses
- Credit-card payments remain Transfers; detailed card purchases are Expenses
- Refunds reduce expense totals
- Import resolves/creates accounts by name so historical JSON does not depend on D1 numeric IDs

## Historical import
Use `family_finance_consolidated_v2_9.json` from the iPhone Finance Activity > Import History flow. Do not commit this personal financial JSON to GitHub.

The consolidated file contains bank history plus parsed Santander credit-card purchases. Marketplace transactions and ambiguous merchants are intentionally left as `needs_review` where their purpose cannot be established from the source document alone.

## Deploy
Replace:
- `public/finances/index.html`
- `src/index.js`
- `README.md`

Health endpoint: `/api/health` -> `2.9.4`


## V2.9.2 import fix
- Validates the finance import schema before upload.
- Imports historical transactions in small batches for reliable iPhone/Worker/D1 operation.
- Shows transactions found, imported, duplicates, and rejected counts.
- Accepts the canonical `{ transactions: [...] }` format and rejects empty/incompatible files clearly.


## V2.9.2 import reliability
- Finance schema migration is race-safe across concurrent iPhone requests.
- `/api/finance/schema` reports migration readiness and current transaction count.
- Import errors now return the exact failing row and D1 error instead of silently stopping at 0/281.
- Historical JSON format remains unchanged from V2.9.1.

## V2.9.4 resumable historical import
- Historical finance imports are resumable through `finance_import_sessions`.
- The iPhone checks server-side progress before uploading and continues from the last confirmed batch.
- Each batch reports cumulative imported, duplicate, rejected, and D1 transaction counts.
- Finance localStorage cache is invalidated after every successful batch and refreshed after completion.
- `/api/finance/schema` now reports transaction counts by month for direct D1 verification.
- If an import pauses, selecting the same JSON again resumes safely; existing rows remain protected by `external_id`.


## V2.9.4 import hotfix
- Fixes a SQL placeholder/bind-count mismatch in the historical finance import INSERT.
- No D1 cleanup is required when transactionCount is 0.
- Reuse the same consolidated V2.9.1 JSON file.
