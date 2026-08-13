begin;

-- Mission progress remains derived exclusively from server-verified activity.
-- The two aggregate metrics below deliberately compose existing verified rows;
-- no browser-supplied counter is accepted.
alter table public.mission_definitions
  drop constraint if exists mission_definitions_metric_check;

alter table public.mission_definitions
  add constraint mission_definitions_metric_check
  check (
    metric in (
      'verified_creation',
      'verified_buy',
      'watchlist_token',
      'ecosystem_role',
      'verified_activity_day'
    )
  );

insert into public.mission_definitions (
  slug,
  title,
  description,
  metric,
  threshold,
  sort_order,
  badge_token_id,
  badge_name,
  badge_description,
  badge_image_url
)
values
  (
    'creator-journey',
    'Creator Journey',
    'Create three DrawCoins whose Base deployment receipts are verified.',
    'verified_creation',
    3,
    40,
    4,
    'Creator Journey',
    'Awarded for three verified DrawCoin creations on Base.',
    'https://drawcoin.app/badges/creator-journey.svg'
  ),
  (
    'ecosystem-builder',
    'Ecosystem Builder',
    'Create a verified DrawCoin and complete a verified purchase.',
    'ecosystem_role',
    2,
    50,
    5,
    'Ecosystem Builder',
    'Awarded for participating as both a DrawCoin creator and collector.',
    'https://drawcoin.app/badges/ecosystem-builder.svg'
  ),
  (
    'base-regular',
    'Base Regular',
    'Complete verified DrawCoin activity on three different UTC days.',
    'verified_activity_day',
    3,
    60,
    6,
    'Base Regular',
    'Awarded for verified DrawCoin activity across three different UTC days.',
    'https://drawcoin.app/badges/base-regular.svg'
  )
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  metric = excluded.metric,
  threshold = excluded.threshold,
  sort_order = excluded.sort_order,
  badge_token_id = excluded.badge_token_id,
  badge_name = excluded.badge_name,
  badge_description = excluded.badge_description,
  badge_image_url = excluded.badge_image_url,
  is_active = true,
  updated_at = now();

-- Keep an auditable proof pointer for every legacy row promoted to verified.
-- Receipt contents are re-read from Base by the server; Supabase values alone
-- are never sufficient to insert one of these records.
create table if not exists public.activity_verifications (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id text not null,
  chain_id bigint not null,
  tx_hash text not null,
  block_number bigint not null,
  log_index integer not null,
  event_name text not null,
  verifier_version smallint not null default 1,
  verified_at timestamptz not null default now(),
  constraint activity_verifications_entity_key
    unique (entity_type, entity_id),
  constraint activity_verifications_evidence_key
    unique (chain_id, tx_hash, log_index, event_name),
  constraint activity_verifications_entity_type_check
    check (entity_type in ('drawcoin', 'transaction')),
  constraint activity_verifications_entity_id_check
    check (length(btrim(entity_id)) between 1 and 128),
  constraint activity_verifications_chain_id_check
    check (chain_id = 8453),
  constraint activity_verifications_tx_hash_check
    check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  constraint activity_verifications_block_number_check
    check (block_number >= 0),
  constraint activity_verifications_log_index_check
    check (log_index >= 0),
  constraint activity_verifications_event_name_check
    check (event_name in ('CoinCreatedV4', 'CoinBuy', 'CoinSell')),
  constraint activity_verifications_entity_event_check
    check (
      (entity_type = 'drawcoin' and event_name = 'CoinCreatedV4')
      or (
        entity_type = 'transaction'
        and event_name in ('CoinBuy', 'CoinSell')
      )
    ),
  constraint activity_verifications_verifier_version_check
    check (verifier_version = 1)
);

create index if not exists activity_verifications_tx_hash_idx
  on public.activity_verifications (tx_hash);

create index if not exists activity_verifications_verified_at_idx
  on public.activity_verifications (verified_at desc);

alter table public.activity_verifications enable row level security;
revoke all on table public.activity_verifications
  from public, anon, authenticated;
grant select, insert, update, delete on table public.activity_verifications
  to service_role;
grant usage, select on sequence public.activity_verifications_id_seq
  to service_role;

-- The caller has already verified the canonical Base receipt and event. This
-- service-role-only function atomically performs the compare-and-set promotion
-- and stores its proof pointer. It intentionally cannot verify arbitrary rows
-- that do not still match the same transaction hash.
create or replace function public.commit_legacy_activity_verification(
  p_entity_type text,
  p_entity_id text,
  p_chain_id bigint,
  p_tx_hash text,
  p_block_number bigint,
  p_log_index integer,
  p_event_name text,
  p_verified_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer := 0;
  v_normalized_hash text := lower(btrim(p_tx_hash));
begin
  if p_entity_type not in ('drawcoin', 'transaction')
    or length(btrim(coalesce(p_entity_id, ''))) not between 1 and 128
    or p_chain_id <> 8453
    or v_normalized_hash !~ '^0x[0-9a-f]{64}$'
    or p_block_number < 0
    or p_log_index < 0
    or p_event_name not in ('CoinCreatedV4', 'CoinBuy', 'CoinSell')
    or (p_entity_type = 'drawcoin' and p_event_name <> 'CoinCreatedV4')
    or (
      p_entity_type = 'transaction'
      and p_event_name not in ('CoinBuy', 'CoinSell')
    )
    or p_verified_at is null
  then
    raise exception 'Invalid legacy verification evidence'
      using errcode = '22023';
  end if;

  if p_entity_type = 'drawcoin' then
    update public.drawcoins
    set verified_at = p_verified_at
    where id::text = btrim(p_entity_id)
      and verified_at is null
      and chain_id = 8453
      and lower(tx_hash) = v_normalized_hash;
    get diagnostics v_updated = row_count;
  else
    update public.transactions
    set verified_at = p_verified_at
    where id::text = btrim(p_entity_id)
      and verified_at is null
      and lower(tx_hash) = v_normalized_hash
      and (
        (p_event_name = 'CoinBuy' and type::text = 'buy')
        or (p_event_name = 'CoinSell' and type::text = 'sell')
      );
    get diagnostics v_updated = row_count;
  end if;

  if v_updated = 0 then
    return false;
  end if;

  insert into public.activity_verifications (
    entity_type,
    entity_id,
    chain_id,
    tx_hash,
    block_number,
    log_index,
    event_name,
    verifier_version,
    verified_at
  )
  values (
    p_entity_type,
    btrim(p_entity_id),
    p_chain_id,
    v_normalized_hash,
    p_block_number,
    p_log_index,
    p_event_name,
    1,
    p_verified_at
  );

  return true;
end;
$$;

revoke execute on function public.commit_legacy_activity_verification(
  text,
  text,
  bigint,
  text,
  bigint,
  integer,
  text,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.commit_legacy_activity_verification(
  text,
  text,
  bigint,
  text,
  bigint,
  integer,
  text,
  timestamptz
) to service_role;

-- A legacy watchlist row is not onchain evidence. It may count only after its
-- wallet owner explicitly re-confirms it through a current SIWE session. The
-- server supplies p_address; direct browser execution is revoked.
create or replace function public.reconfirm_legacy_watchlists(
  p_address text
)
returns table (
  confirmed_count bigint,
  remaining_count bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_normalized_address text := lower(btrim(p_address));
  v_confirmed bigint := 0;
  v_remaining bigint := 0;
begin
  if v_normalized_address !~ '^0x[0-9a-f]{40}$' then
    raise exception 'Invalid wallet address'
      using errcode = '22023';
  end if;

  with confirmed as (
    update public.watchlists as watchlist
    set verified_at = statement_timestamp()
    where lower(watchlist.user_address) = v_normalized_address
      and watchlist.verified_at is null
      and exists (
        select 1
        from public.drawcoins as coin
        where lower(coin.contract_address) = lower(watchlist.token_address)
          and coin.verified_at is not null
      )
    returning 1
  )
  select count(*)::bigint into v_confirmed from confirmed;

  select count(*)::bigint into v_remaining
  from public.watchlists as watchlist
  where lower(watchlist.user_address) = v_normalized_address
    and watchlist.verified_at is null;

  return query select v_confirmed, v_remaining;
end;
$$;

revoke execute on function public.reconfirm_legacy_watchlists(text)
  from public, anon, authenticated;
grant execute on function public.reconfirm_legacy_watchlists(text)
  to service_role;

commit;
