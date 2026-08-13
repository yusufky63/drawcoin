-- DrawCoin missions and badges
--
-- Trust model:
--   * Wallet ownership is verified by the Next.js SIWE session.
--   * Onchain/offchain activity is written by server-side service_role clients only.
--   * Mission progress is derived from those verified records and is never accepted
--     from a browser payload.

-- Existing rows predate server-side verification and intentionally remain NULL.
-- Future service_role inserts receive a verification timestamp by default, after
-- the API has verified the activity.
alter table public.drawcoins
  add column if not exists verified_at timestamptz;

alter table public.drawcoins
  alter column verified_at set default now();

alter table public.transactions
  add column if not exists verified_at timestamptz;

alter table public.transactions
  alter column verified_at set default now();

alter table public.watchlists
  add column if not exists verified_at timestamptz;

alter table public.watchlists
  alter column verified_at set default now();

-- One-time SIWE nonces are stored as SHA-256 hashes. The HttpOnly browser cookie
-- carries the signed challenge, while this table provides atomic, cross-instance
-- replay protection for the verification endpoint.
create table if not exists public.siwe_nonces (
  nonce_hash text primary key,
  client_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint siwe_nonces_nonce_hash_format_check
    check (nonce_hash ~ '^[0-9a-f]{64}$'),
  constraint siwe_nonces_client_hash_format_check
    check (client_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists siwe_nonces_expires_at_idx
  on public.siwe_nonces (expires_at);

create index if not exists siwe_nonces_client_expires_idx
  on public.siwe_nonces (client_hash, expires_at);

alter table public.siwe_nonces enable row level security;

revoke all on table public.siwe_nonces from public, anon, authenticated;
grant select, insert, update, delete on table public.siwe_nonces to service_role;

-- One bounded row per anonymized client keeps rate-limit storage finite. The
-- client hash is an HMAC produced by the server; raw IP addresses never reach
-- the database. Expired buckets are removed by the atomic issuance function.
create table if not exists public.siwe_nonce_rate_limits (
  client_hash text primary key,
  request_count smallint not null,
  window_started_at timestamptz not null,
  reset_at timestamptz not null,
  constraint siwe_nonce_rate_limits_client_hash_format_check
    check (client_hash ~ '^[0-9a-f]{64}$'),
  constraint siwe_nonce_rate_limits_request_count_check
    check (request_count between 1 and 10),
  constraint siwe_nonce_rate_limits_window_check
    check (reset_at > window_started_at)
);

create index if not exists siwe_nonce_rate_limits_reset_at_idx
  on public.siwe_nonce_rate_limits (reset_at);

alter table public.siwe_nonce_rate_limits enable row level security;

revoke all on table public.siwe_nonce_rate_limits
  from public, anon, authenticated;
grant select, insert, update, delete on table public.siwe_nonce_rate_limits
  to service_role;

-- A single, short transaction performs cleanup, capacity checks, per-client
-- accounting, and nonce insertion. try-advisory-lock prevents a request flood
-- from building a lock queue while preserving strict global capacity.
create schema if not exists drawcoin_private;
revoke all on schema drawcoin_private from public, anon, authenticated;
grant usage on schema drawcoin_private to service_role;

create or replace function drawcoin_private.issue_siwe_nonce_internal(
  p_nonce_hash text,
  p_client_hash text,
  p_expires_at timestamptz
)
returns table (
  allowed boolean,
  reason text,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_request_count smallint;
  v_reset_at timestamptz;
  v_active_count integer;
  v_global_count integer;
  v_next_expiry timestamptz;
begin
  if p_nonce_hash !~ '^[0-9a-f]{64}$'
    or p_client_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid SIWE nonce or client hash format'
      using errcode = '22023';
  end if;

  if p_expires_at <= v_now
    or p_expires_at > v_now + interval '10 minutes'
  then
    raise exception 'Invalid SIWE nonce expiration'
      using errcode = '22023';
  end if;

  if not pg_try_advisory_xact_lock(
    hashtextextended('drawcoin:siwe-nonce-issuance', 0)
  ) then
    return query select false, 'busy'::text, 1;
    return;
  end if;

  delete from public.siwe_nonces
  where expires_at <= v_now;

  delete from public.siwe_nonce_rate_limits
  where reset_at <= v_now;

  select count(*)::integer, min(expires_at)
  into v_global_count, v_next_expiry
  from public.siwe_nonces;

  if v_global_count >= 10000 then
    return query
      select
        false,
        'global_capacity'::text,
        greatest(
          1,
          ceil(extract(epoch from (v_next_expiry - v_now)))::integer
        );
    return;
  end if;

  select request_count, reset_at
  into v_request_count, v_reset_at
  from public.siwe_nonce_rate_limits
  where client_hash = p_client_hash
  for update;

  if found then
    if v_request_count >= 10 then
      return query
        select
          false,
          'rate_limited'::text,
          greatest(
            1,
            ceil(extract(epoch from (v_reset_at - v_now)))::integer
          );
      return;
    end if;

    update public.siwe_nonce_rate_limits
    set request_count = request_count + 1
    where client_hash = p_client_hash;
  else
    insert into public.siwe_nonce_rate_limits (
      client_hash,
      request_count,
      window_started_at,
      reset_at
    )
    values (
      p_client_hash,
      1,
      v_now,
      v_now + interval '10 minutes'
    );
  end if;

  select count(*)::integer, min(expires_at)
  into v_active_count, v_next_expiry
  from public.siwe_nonces
  where client_hash = p_client_hash;

  if v_active_count >= 3 then
    return query
      select
        false,
        'active_limit'::text,
        greatest(
          1,
          ceil(extract(epoch from (v_next_expiry - v_now)))::integer
        );
    return;
  end if;

  insert into public.siwe_nonces (
    nonce_hash,
    client_hash,
    expires_at
  )
  values (
    p_nonce_hash,
    p_client_hash,
    p_expires_at
  );

  return query select true, 'ok'::text, 0;
end;
$$;

revoke execute on function drawcoin_private.issue_siwe_nonce_internal(
  text,
  text,
  timestamptz
) from public, anon, authenticated;
grant execute on function drawcoin_private.issue_siwe_nonce_internal(
  text,
  text,
  timestamptz
) to service_role;

-- PostgREST exposes only this invoker wrapper. The privileged implementation
-- stays in the unexposed private schema and is executable only by service_role.
create or replace function public.issue_siwe_nonce(
  p_nonce_hash text,
  p_client_hash text,
  p_expires_at timestamptz
)
returns table (
  allowed boolean,
  reason text,
  retry_after_seconds integer
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from drawcoin_private.issue_siwe_nonce_internal($1, $2, $3);
$$;

revoke execute on function public.issue_siwe_nonce(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.issue_siwe_nonce(text, text, timestamptz)
  to service_role;

create table if not exists public.mission_definitions (
  id bigint generated always as identity primary key,
  slug text not null,
  title text not null,
  description text not null,
  metric text not null,
  threshold bigint not null,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  badge_token_id bigint not null,
  badge_name text not null,
  badge_description text not null,
  badge_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mission_definitions_slug_key unique (slug),
  constraint mission_definitions_badge_token_id_key unique (badge_token_id),
  constraint mission_definitions_slug_format_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint mission_definitions_metric_check
    check (metric in ('hand_drawn_coin', 'verified_buy', 'watchlist_token')),
  constraint mission_definitions_threshold_check check (threshold > 0),
  constraint mission_definitions_badge_token_id_check check (badge_token_id > 0)
);

create table if not exists public.user_missions (
  id bigint generated always as identity primary key,
  address text not null,
  mission_id bigint not null,
  progress bigint not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_missions_address_mission_key unique (address, mission_id),
  constraint user_missions_mission_id_fkey
    foreign key (mission_id)
    references public.mission_definitions(id)
    on delete cascade,
  constraint user_missions_address_format_check
    check (address ~ '^0x[0-9a-f]{40}$'),
  constraint user_missions_progress_check check (progress >= 0)
);

create table if not exists public.user_badges (
  id bigint generated always as identity primary key,
  address text not null,
  mission_id bigint not null,
  earned_at timestamptz not null default now(),
  claim_status text not null default 'unclaimed',
  claim_tx_hash text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_badges_address_mission_key unique (address, mission_id),
  constraint user_badges_mission_id_fkey
    foreign key (mission_id)
    references public.mission_definitions(id)
    on delete cascade,
  constraint user_badges_address_format_check
    check (address ~ '^0x[0-9a-f]{40}$'),
  constraint user_badges_claim_status_check
    check (claim_status in ('unclaimed', 'pending', 'claimed', 'failed')),
  constraint user_badges_claim_tx_hash_format_check
    check (claim_tx_hash is null or claim_tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  constraint user_badges_claimed_state_check
    check (
      (claim_status = 'claimed' and claim_tx_hash is not null and claimed_at is not null)
      or claim_status <> 'claimed'
    )
);

-- Foreign keys are not indexed automatically by PostgreSQL.
create index if not exists mission_definitions_active_sort_idx
  on public.mission_definitions (is_active, sort_order);

create index if not exists user_missions_mission_id_idx
  on public.user_missions (mission_id);

create index if not exists user_missions_address_completed_idx
  on public.user_missions (address, completed_at)
  where completed_at is not null;

create index if not exists user_badges_mission_id_idx
  on public.user_badges (mission_id);

create index if not exists user_badges_address_earned_idx
  on public.user_badges (address, earned_at desc);

create unique index if not exists user_badges_claim_tx_hash_key
  on public.user_badges (lower(claim_tx_hash))
  where claim_tx_hash is not null;

-- Support the three server-side mission predicates.
create index if not exists drawcoins_creator_type_verified_idx
  on public.drawcoins (lower(creator_address), creation_type)
  where verified_at is not null;

create index if not exists transactions_user_type_verified_idx
  on public.transactions (lower(user_address), type)
  where verified_at is not null;

create unique index if not exists watchlists_user_verified_token_idx
  on public.watchlists (lower(user_address), lower(token_address))
  where verified_at is not null;

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
    'first-stroke',
    'First Stroke',
    'Create your first verified hand-drawn coin on Base.',
    'hand_drawn_coin',
    1,
    10,
    1,
    'First Stroke',
    'Awarded for creating a verified hand-drawn DrawCoin on Base.',
    'https://drawcoin.app/badges/first-stroke.svg'
  ),
  (
    'collector',
    'Collector',
    'Complete your first verified DrawCoin purchase on Base.',
    'verified_buy',
    1,
    20,
    2,
    'Collector',
    'Awarded for completing a verified DrawCoin purchase on Base.',
    'https://drawcoin.app/badges/collector.svg'
  ),
  (
    'curator',
    'Curator',
    'Add five distinct DrawCoins to your signed-in watchlist.',
    'watchlist_token',
    5,
    30,
    3,
    'Curator',
    'Awarded for curating five distinct DrawCoins.',
    'https://drawcoin.app/badges/curator.svg'
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
  updated_at = now();

-- Lock all mission state behind server-side service_role access. Only the static
-- catalog is readable directly through the Data API.
alter table public.mission_definitions enable row level security;
alter table public.user_missions enable row level security;
alter table public.user_badges enable row level security;

revoke all on table public.mission_definitions from public, anon, authenticated;
revoke all on table public.user_missions from public, anon, authenticated;
revoke all on table public.user_badges from public, anon, authenticated;

grant select on table public.mission_definitions to anon, authenticated;

grant select, insert, update, delete on table public.mission_definitions to service_role;
grant select, insert, update, delete on table public.user_missions to service_role;
grant select, insert, update, delete on table public.user_badges to service_role;

grant usage, select on sequence public.mission_definitions_id_seq to service_role;
grant usage, select on sequence public.user_missions_id_seq to service_role;
grant usage, select on sequence public.user_badges_id_seq to service_role;

drop policy if exists "Mission catalog is public" on public.mission_definitions;
create policy "Mission catalog is public"
  on public.mission_definitions
  for select
  to anon, authenticated
  using (is_active = true);

-- Browser writes to activity tables would let a caller award their own badge.
-- Remove every write-capable policy (including FOR ALL) and revoke the matching
-- table privileges. service_role keeps its explicit grants and bypasses RLS.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('drawcoins', 'transactions', 'watchlists')
      and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end
$$;

alter table public.drawcoins enable row level security;
alter table public.transactions enable row level security;
alter table public.watchlists enable row level security;

revoke insert, update, delete on table public.drawcoins from anon, authenticated;
revoke insert, update, delete on table public.transactions from anon, authenticated;
revoke insert, update, delete on table public.watchlists from anon, authenticated;

grant select on table public.drawcoins to anon, authenticated;
grant select on table public.transactions to anon, authenticated;
revoke select on table public.watchlists from anon, authenticated;

grant select, insert, update, delete on table public.drawcoins to service_role;
grant select, insert, update, delete on table public.transactions to service_role;
grant select, insert, update, delete on table public.watchlists to service_role;

-- These records already power DrawCoin's public discovery, leaderboards and
-- onchain activity screens. Re-create explicit read-only policies in case an
-- older FOR ALL policy was removed above.
drop policy if exists "Anyone can read drawcoins" on public.drawcoins;
drop policy if exists "DrawCoins are publicly readable" on public.drawcoins;
create policy "DrawCoins are publicly readable"
  on public.drawcoins
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Transactions are publicly readable" on public.transactions;
create policy "Transactions are publicly readable"
  on public.transactions
  for select
  to anon, authenticated
  using (true);

-- Watchlist membership and price snapshots are private. Reads go through the
-- SIWE-protected server route; aggregate public counts use service_role.
drop policy if exists "Users can view their own watchlist" on public.watchlists;
drop policy if exists "Watchlists are publicly readable" on public.watchlists;
