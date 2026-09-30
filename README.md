# Family Dashboard V2.8.1.1

Historical Finance Import & Review Queue.

## New
- Secure local JSON import from the Finances > Activity screen.
- Historical data is selected from the device and POSTed directly to the protected Worker; it is not stored in public assets or GitHub.
- NEEDS REVIEW filter for imported/ambiguous transactions.
- Data coverage notice: bank-account statements do not include the underlying credit-card purchases. Card settlements remain transfers to avoid double counting.
- Existing transaction editing can mark imported items as reviewed and optionally create categorization rules.

## Import
1. Deploy V2.8.1.1.
2. Open /finances/ > Activity.
3. Tap IMPORT HISTORY.
4. Select the provided family_finance_history_may_aug_2026.json file from Files.
5. Confirm import. Re-importing is safe: source + externalId duplicates are skipped.
6. Use NEEDS REVIEW to work through ambiguous items.

Never commit the history JSON or bank statements to the public GitHub repository.


## V2.8.1 - Finance Period Navigation
- Replaces the unreliable month text control with previous/next month buttons.
- Displays a readable month label such as September 2026.
- Tapping the month label opens a legacy-iOS-safe month/year picker.
- Month changes render cached data immediately and refresh D1 in the background.
