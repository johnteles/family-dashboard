# Family Dashboard V2.3.2

Grocery sync stability update.

## Changes
- Optimistic UI remains instant.
- Per-item pending state prevents polling from overwriting an unconfirmed local tap.
- Grocery writes now send the desired final state (`set`) instead of a blind server-side toggle.
- Writes are serialized per item so the latest user intention wins, even with rapid taps.
- Polling continues every 5 seconds for cross-device synchronization.
- Failed writes clear pending state and reconcile with the server.

## Test
1. Open Grocery on iPad and iPhone.
2. Tap an item once: the check should change immediately and stay stable.
3. Tap the same item rapidly several times in **All Items**: the final visible state should be the final state stored on the server.
4. Confirm the other device converges to the same state within about 5 seconds.
5. `/api/health` should report version `2.3.2`.
