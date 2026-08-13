-- Lock down legacy portfolio access, harden trigger function resolution,
-- and index the remaining unindexed foreign key reported by Supabase advisors.

-- Portfolio rows are derived by the verified transaction trigger. Preserve
-- the existing public read policy used by shared portfolio pages, but remove
-- the legacy write-through policy and browser write privileges.
alter table public.portfolio enable row level security;

drop policy if exists "Users can update their own portfolio." on public.portfolio;

revoke insert, update, delete, truncate, references, trigger
on table public.portfolio
from public, anon, authenticated;

-- Qualify relation names and pin an empty search_path so trigger execution
-- cannot be redirected through objects created in a mutable schema.
create or replace function public.increment_watchlist_count()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  update public.drawcoins
  set watchlist_count = coalesce(watchlist_count, 0) + 1
  where contract_address = new.token_address;
  return new;
end;
$function$;

create or replace function public.decrement_watchlist_count()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  update public.drawcoins
  set watchlist_count = greatest(coalesce(watchlist_count, 0) - 1, 0)
  where contract_address = old.token_address;
  return old;
end;
$function$;

alter function public.update_updated_at_column() set search_path = '';
alter function public.update_user_stats() set search_path = '';
alter function public.update_portfolio_on_transaction() set search_path = '';

create index if not exists idx_watchlists_token_address
  on public.watchlists using btree (token_address);
