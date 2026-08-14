begin;

-- Keep the public catalog sortable without joining and regrouping the full
-- transaction history on every Explore/Markets request. Only verified Base
-- buy/sell records contribute to these fields.
alter table public.drawcoins
  add column if not exists last_trade_at timestamptz,
  add column if not exists last_trade_type text,
  add column if not exists verified_trade_count integer not null default 0;

alter table public.drawcoins
  drop constraint if exists drawcoins_last_trade_type_check,
  add constraint drawcoins_last_trade_type_check
    check (last_trade_type is null or last_trade_type in ('buy', 'sell')),
  drop constraint if exists drawcoins_verified_trade_count_nonnegative,
  add constraint drawcoins_verified_trade_count_nonnegative
    check (verified_trade_count >= 0);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.refresh_drawcoin_trade_activity(
  p_token_address text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last_trade_at timestamptz;
  v_last_trade_type text;
  v_verified_trade_count integer;
begin
  if p_token_address is null or btrim(p_token_address) = '' then
    return;
  end if;

  select
    count(*)::integer,
    max(transaction_row."timestamp")
  into
    v_verified_trade_count,
    v_last_trade_at
  from public.transactions as transaction_row
  where lower(transaction_row.token_address) = lower(p_token_address)
    and transaction_row.verified_at is not null
    and transaction_row.type::text in ('buy', 'sell');

  select transaction_row.type::text
  into v_last_trade_type
  from public.transactions as transaction_row
  where lower(transaction_row.token_address) = lower(p_token_address)
    and transaction_row.verified_at is not null
    and transaction_row.type::text in ('buy', 'sell')
  order by transaction_row."timestamp" desc nulls last, transaction_row.id desc
  limit 1;

  update public.drawcoins as coin
  set
    last_trade_at = v_last_trade_at,
    last_trade_type = v_last_trade_type,
    verified_trade_count = coalesce(v_verified_trade_count, 0)
  where lower(coin.contract_address) = lower(p_token_address);
end;
$$;

revoke all on function private.refresh_drawcoin_trade_activity(text)
  from public, anon, authenticated;

create or replace function private.sync_drawcoin_trade_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    perform private.refresh_drawcoin_trade_activity(old.token_address);
  end if;

  if tg_op <> 'DELETE' then
    perform private.refresh_drawcoin_trade_activity(new.token_address);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_drawcoin_trade_activity()
  from public, anon, authenticated;

drop trigger if exists sync_drawcoin_trade_activity on public.transactions;
create trigger sync_drawcoin_trade_activity
after insert or delete or update of token_address, type, "timestamp", verified_at
on public.transactions
for each row
execute function private.sync_drawcoin_trade_activity();

do $$
declare
  coin_row record;
begin
  for coin_row in
    select contract_address from public.drawcoins
  loop
    perform private.refresh_drawcoin_trade_activity(coin_row.contract_address);
  end loop;
end;
$$;

create index if not exists idx_drawcoins_last_trade_rank
  on public.drawcoins (last_trade_at desc nulls last, created_at desc, id desc);

create index if not exists idx_drawcoins_verified_trade_count_rank
  on public.drawcoins (
    verified_trade_count desc,
    last_trade_at desc nulls last,
    created_at desc,
    id desc
  );

create index if not exists idx_drawcoins_holders_rank
  on public.drawcoins (holders desc nulls last, created_at desc, id desc);

create index if not exists idx_transactions_verified_token_timestamp
  on public.transactions (
    lower(token_address),
    "timestamp" desc nulls last,
    id desc
  )
  where verified_at is not null
    and type in (
      'buy'::public.transaction_type,
      'sell'::public.transaction_type
    );

-- Persistent server-only cache for Base primary names. Null names are cached
-- too, with a shorter expiry, so wallets without a Basename do not cause an
-- RPC request on every page load.
create table if not exists public.creator_identity_cache (
  address text primary key,
  basename text,
  source text not null default 'none',
  checked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint creator_identity_cache_address_lowercase
    check (address = lower(address) and address ~ '^0x[0-9a-f]{40}$'),
  constraint creator_identity_cache_basename_shape
    check (
      basename is null
      or (basename = lower(basename) and basename like '%.base.eth')
    ),
  constraint creator_identity_cache_source_check
    check (source in ('profile', 'base-l2', 'ensip19', 'none'))
);

create index if not exists creator_identity_cache_expires_at_idx
  on public.creator_identity_cache (expires_at);

alter table public.creator_identity_cache enable row level security;
revoke all on table public.creator_identity_cache
  from public, anon, authenticated;
grant select, insert, update, delete on table public.creator_identity_cache
  to service_role;

comment on table public.creator_identity_cache is
  'Server-only bounded cache of public Base primary names; never exposed directly to browser roles.';

commit;
