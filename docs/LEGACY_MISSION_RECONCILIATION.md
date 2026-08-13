# Legacy mission reconciliation

DrawCoin never awards missions directly from old Supabase counters. Historical
rows become eligible only after their canonical Base evidence has been checked.

The implementation follows the current Zora Coins skill (`0.5.2`) for protocol
semantics while keeping the repository's deliberately compatible
`@zoralabs/coins-sdk@0.4.1`. It uses only APIs exported by the installed version:
`getCoinCreateFromLogs`, the official factory deployment address, and Viem
receipt parsing. No Zora query API or `ZORA_API_KEY` is involved.

## Deployment order

1. Back up the production database.
2. Apply `supabase/migrations/20260813163658_expand_verified_missions.sql`.
3. Deploy the application routes that reference the migration's RPCs.
4. Run a small dry-run for drawcoins, inspect every rejection, then apply.
5. Run the transactions pass only after the corresponding drawcoins have been
   verified. The `all` apply mode already processes these phases in that order.

The migration is idempotent for mission definitions and does not mark any
legacy activity verified by itself.

## Admin interface

All requests require `Authorization: Bearer $CRON_SECRET`. Never place the
secret in a query string or browser bundle.

Read-only evidence check:

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod `
  -Headers $headers `
  -Uri "http://127.0.0.1:3000/api/admin/reconcile-legacy-missions?scope=drawcoins&limit=10"
```

Apply the canonical matches and evaluate missions for affected wallets:

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod `
  -Method Post `
  -Headers $headers `
  -Uri "http://127.0.0.1:3000/api/admin/reconcile-legacy-missions?scope=all&limit=10"
```

Query parameters:

- `scope=drawcoins|transactions|all` (default `all`)
- `limit=1..50` per selected entity type (default `10`)
- `offset=0..10000` for deterministic descending-page maintenance runs
- `address=0x...` for a targeted wallet pass

`GET` is always dry-run. `POST` is always apply. An apply is replay-safe: the
database promotion uses `verified_at is null`, the original transaction hash,
and an immutable proof-row uniqueness constraint. A concurrent or repeated
run reports `already_verified` instead of overwriting the row.

For a full historical pass, process offsets from the highest page down to zero
for `scope=drawcoins`, then repeat for `scope=transactions`. Descending order
prevents successful compare-and-set promotions from shifting unprocessed rows
out of the next page.

## Canonical evidence

Creation rows require all of the following:

- successful Base receipt;
- `CoinCreatedV4` emitted by the official Zora factory;
- event coin and caller matching the stored addresses;
- event platform referrer matching DrawCoin's configured referrer;
- deployed bytecode at the coin address.

Buy/sell rows require:

- an already verified DrawCoin;
- successful Base receipt;
- strict `CoinBuy`/`CoinSell` log emitted by that exact coin;
- recipient/seller and event direction matching the stored row.

Rejected or unavailable rows stay unverified and cannot contribute to any
mission.

## Legacy watchlists

Watchlists do not have onchain receipts, so they are never batch-promoted. The
Missions UI shows the signed-in owner a `Confirm old watchlist` action. That
action calls `PATCH /api/watchlist` under the current HttpOnly SIWE session.
Only rows pointing to an already verified DrawCoin are confirmed; all others
remain visible as legacy progress but cannot unlock a badge.
