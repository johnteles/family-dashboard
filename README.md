# Family Dashboard V2.7.2

## Finance UX & Performance

V2.7.2 keeps the V2.7 Finance Core and adds a responsive mobile finance navigation plus stale-while-revalidate caching.

### Improvements
- compact icon-first Finances navigation for iPhone
- cached Finance snapshot renders immediately on iPhone
- D1 refresh runs silently in the background
- switching Finance tabs never triggers a network request
- changing month renders any cached month immediately, then refreshes
- wall iPad Finances renders its last known summary immediately, then refreshes silently
- no schema or D1 migration changes from V2.7

### Upgrade
Replace:
- `public/finances/index.html`
- `public/index.html`
- `src/index.js`
- `README.md`

Existing Grocery, Calendar, Bills, Finance data, D1 bindings, Google OAuth and secrets remain unchanged.


## V2.7.2 - Mobile Form Polish
- Prevents horizontal modal drift on iPhone.
- Constrains all finance form controls to the viewport.
- Compacts date fields and vertical spacing.
- Keeps modal actions accessible while scrolling.
- Applies the same modal sizing rules across Transactions, Bills, Budgets, Categories, and Accounts.
