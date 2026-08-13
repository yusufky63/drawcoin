-- Persist the exact market-cap expression used by DrawCoin's Supabase
-- snapshots so PostgREST can order the complete result set before paging.
-- Invalid or unavailable persisted metrics remain NULL rather than being
-- coerced to zero. Production stores both inputs as NUMERIC.
alter table public.drawcoins
  add column if not exists market_cap numeric generated always as (
    case
      when current_price > 0 and total_supply > 0
      then current_price * total_supply
      else null
    end
  ) stored;

create index if not exists idx_drawcoins_market_cap_rank
  on public.drawcoins (market_cap desc nulls last, created_at desc, id desc);
