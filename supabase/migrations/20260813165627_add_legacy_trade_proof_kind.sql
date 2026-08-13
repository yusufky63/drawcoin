begin;

-- v1 proofs point directly at CoinCreatedV4/CoinBuy/CoinSell logs. Some early
-- DrawCoin trades used Zora's official Universal Router integration before the
-- coin emitted CoinBuy/CoinSell. v2 records the exact positive ERC-20 Transfer
-- log and the approved execution path instead of pretending it was a coin log.
alter table public.activity_verifications
  add column if not exists proof_kind text not null default 'direct_coin_event';

alter table public.activity_verifications
  drop constraint if exists activity_verifications_proof_kind_check;
alter table public.activity_verifications
  add constraint activity_verifications_proof_kind_check
  check (
    proof_kind in (
      'direct_coin_event',
      'universal_router_transfer',
      'entrypoint_transfer'
    )
  );

alter table public.activity_verifications
  drop constraint if exists activity_verifications_verifier_version_check;
alter table public.activity_verifications
  add constraint activity_verifications_verifier_version_check
  check (verifier_version in (1, 2));

alter table public.activity_verifications
  drop constraint if exists activity_verifications_proof_version_check;
alter table public.activity_verifications
  add constraint activity_verifications_proof_version_check
  check (
    (
      verifier_version = 1
      and proof_kind = 'direct_coin_event'
    )
    or (
      verifier_version = 2
      and entity_type = 'transaction'
      and proof_kind in ('universal_router_transfer', 'entrypoint_transfer')
      and event_name in ('CoinBuy', 'CoinSell')
    )
  );

comment on column public.activity_verifications.proof_kind is
  'Exact onchain evidence path: direct protocol event or a positive token Transfer executed through an approved Universal Router / ERC-4337 EntryPoint path.';

create or replace function public.commit_legacy_trade_verification(
  p_entity_id text,
  p_chain_id bigint,
  p_tx_hash text,
  p_block_number bigint,
  p_log_index integer,
  p_event_name text,
  p_proof_kind text,
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
  if length(btrim(coalesce(p_entity_id, ''))) not between 1 and 128
    or p_chain_id <> 8453
    or v_normalized_hash !~ '^0x[0-9a-f]{64}$'
    or p_block_number < 0
    or p_log_index < 0
    or p_event_name not in ('CoinBuy', 'CoinSell')
    or p_proof_kind not in ('universal_router_transfer', 'entrypoint_transfer')
    or p_verified_at is null
  then
    raise exception 'Invalid legacy trade verification evidence'
      using errcode = '22023';
  end if;

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
    proof_kind,
    verifier_version,
    verified_at
  )
  values (
    'transaction',
    btrim(p_entity_id),
    p_chain_id,
    v_normalized_hash,
    p_block_number,
    p_log_index,
    p_event_name,
    p_proof_kind,
    2,
    p_verified_at
  );

  return true;
end;
$$;

revoke execute on function public.commit_legacy_trade_verification(
  text,
  bigint,
  text,
  bigint,
  integer,
  text,
  text,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.commit_legacy_trade_verification(
  text,
  bigint,
  text,
  bigint,
  integer,
  text,
  text,
  timestamptz
) to service_role;

commit;
