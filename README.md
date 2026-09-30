# Family Dashboard V2.9.1 - Credit Card Intelligence

V2.9.1 extends the Finance Core to consolidate bank statements and detailed credit-card statements without double counting.

## New in V2.9.1
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

Health endpoint: `/api/health` -> `2.9`


## V2.9.1 import fix
- Validates the finance import schema before upload.
- Imports historical transactions in small batches for reliable iPhone/Worker/D1 operation.
- Shows transactions found, imported, duplicates, and rejected counts.
- Accepts the canonical `{ transactions: [...] }` format and rejects empty/incompatible files clearly.
