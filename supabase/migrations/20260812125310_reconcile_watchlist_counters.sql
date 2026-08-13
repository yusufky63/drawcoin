-- Reconcile the denormalized watchlist counter and keep it exact for every
-- future watchlist mutation. The locks keep writes from racing the one-time
-- backfill while reads remain available.
begin;

lock table public.watchlists in share row exclusive mode;
lock table public.drawcoins in share row exclusive mode;

-- Equality checks throughout this migration are case-insensitive. Dedicated
-- expression indexes avoid scans; the existing (user_address, token_address)
-- index cannot support a lookup by token_address alone.
create index if not exists watchlists_token_address_lower_idx
  on public.watchlists using btree (lower(token_address));

create index if not exists drawcoins_contract_address_lower_idx
  on public.drawcoins using btree (lower(contract_address));

-- Reset every counter, including legacy rows with no watchlist entries. This
-- single set-based statement is executed while watchlist writes are locked.
with actual_counts as (
  select
    lower(token_address) as normalized_address,
    count(*)::integer as watchlist_count
  from public.watchlists
  group by lower(token_address)
), reconciled_counts as (
  select
    drawcoin.id,
    coalesce(actual_counts.watchlist_count, 0) as watchlist_count
  from public.drawcoins as drawcoin
  left join actual_counts
    on actual_counts.normalized_address = lower(drawcoin.contract_address)
)
update public.drawcoins as drawcoin
set watchlist_count = reconciled_counts.watchlist_count
from reconciled_counts
where drawcoin.id = reconciled_counts.id
  and drawcoin.watchlist_count is distinct from reconciled_counts.watchlist_count;

-- Counters are total values: new rows start at zero and NULL is not a valid
-- state after the legacy reconciliation above.
alter table public.drawcoins
  alter column watchlist_count set default 0;
alter table public.drawcoins
  alter column watchlist_count set not null;

-- Preserve the non-negative invariant even for privileged maintenance writes
-- that do not pass through the watchlist triggers.
alter table public.drawcoins
  drop constraint if exists drawcoins_watchlist_count_nonnegative;
alter table public.drawcoins
  add constraint drawcoins_watchlist_count_nonnegative
  check (watchlist_count >= 0);

create or replace function public.increment_watchlist_count()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  update public.drawcoins
  set watchlist_count = greatest(coalesce(watchlist_count, 0), 0) + 1
  where lower(contract_address) = lower(new.token_address);

  return new;
end;
$function$;

create or replace function public.decrement_watchlist_count()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  update public.drawcoins
  set watchlist_count = greatest(coalesce(watchlist_count, 0) - 1, 0)
  where lower(contract_address) = lower(old.token_address);

  return old;
end;
$function$;

create or replace function public.update_watchlist_count_for_address_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  -- A checksum-only address update does not change membership.
  if lower(new.token_address) = lower(old.token_address) then
    return new;
  end if;

  -- One statement updates both rows, keeping the adjustment atomic and using
  -- the same non-negative rule as DELETE.
  update public.drawcoins
  set watchlist_count = case
    when lower(contract_address) = lower(old.token_address)
      then greatest(coalesce(watchlist_count, 0) - 1, 0)
    when lower(contract_address) = lower(new.token_address)
      then greatest(coalesce(watchlist_count, 0), 0) + 1
    else watchlist_count
  end
  where lower(contract_address) in (
    lower(old.token_address),
    lower(new.token_address)
  );

  return new;
end;
$function$;

drop trigger if exists trigger_increment_watchlist_count
  on public.watchlists;
create trigger trigger_increment_watchlist_count
after insert on public.watchlists
for each row
execute function public.increment_watchlist_count();

drop trigger if exists trigger_decrement_watchlist_count
  on public.watchlists;
create trigger trigger_decrement_watchlist_count
after delete on public.watchlists
for each row
execute function public.decrement_watchlist_count();

drop trigger if exists trigger_update_watchlist_count
  on public.watchlists;
create trigger trigger_update_watchlist_count
after update of token_address on public.watchlists
for each row
when (old.token_address is distinct from new.token_address)
execute function public.update_watchlist_count_for_address_change();

-- Trigger functions are implementation details. Existing table privileges and
-- RLS policies remain untouched; only service_role may mutate watchlists.
revoke execute on function public.increment_watchlist_count()
  from public, anon, authenticated;
revoke execute on function public.decrement_watchlist_count()
  from public, anon, authenticated;
revoke execute on function public.update_watchlist_count_for_address_change()
  from public, anon, authenticated;

grant execute on function public.increment_watchlist_count()
  to service_role;
grant execute on function public.decrement_watchlist_count()
  to service_role;
grant execute on function public.update_watchlist_count_for_address_change()
  to service_role;

-- Return authoritative counts from the private watchlist rows. The first input
-- spelling is preserved while duplicate addresses are collapsed by lower-case
-- identity. Empty, NULL, and whitespace-only entries are ignored.
create or replace function public.get_watchlist_counts(p_addresses text[])
returns table (
  token_address text,
  watchlist_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with requested as (
    select distinct on (lower(btrim(input.token_address)))
      btrim(input.token_address) as token_address,
      lower(btrim(input.token_address)) as normalized_address,
      input.ordinality
    from unnest(coalesce(p_addresses, array[]::text[]))
      with ordinality as input(token_address, ordinality)
    where input.token_address is not null
      and btrim(input.token_address) <> ''
    order by lower(btrim(input.token_address)), input.ordinality
  )
  select
    requested.token_address,
    count(watchlist.id)::bigint as watchlist_count
  from requested
  left join public.watchlists as watchlist
    on lower(watchlist.token_address) = requested.normalized_address
  group by
    requested.token_address,
    requested.normalized_address,
    requested.ordinality
  order by requested.ordinality;
$function$;

comment on function public.get_watchlist_counts(text[]) is
  'Returns authoritative case-insensitive watchlist counts for server routes.';

revoke execute on function public.get_watchlist_counts(text[])
  from public, anon, authenticated;
grant execute on function public.get_watchlist_counts(text[])
  to service_role;

commit;
