-- Short-lived, centrally enforced ERC-7677 sponsorship grants.
--
-- The browser only receives an HMAC-authenticated grant. Both issuance and
-- usage are persisted here so multiple Next.js/serverless instances cannot
-- independently sponsor the same claim. If this migration or either RPC is
-- unavailable, the application fails closed and uses the user-paid claim path.

create table if not exists public.paymaster_grants (
  grant_id uuid primary key,
  account text not null,
  contract_address text not null,
  chain_id bigint not null,
  token_id numeric(78, 0) not null,
  claim_nonce numeric(78, 0) not null,
  claim_calldata_hash text not null,
  expires_at timestamptz not null,
  stub_calls smallint not null default 0,
  data_calls smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paymaster_grants_scope_key
    unique (account, chain_id, contract_address, token_id, claim_nonce),
  constraint paymaster_grants_account_format_check
    check (account ~ '^0x[0-9a-f]{40}$'),
  constraint paymaster_grants_contract_format_check
    check (contract_address ~ '^0x[0-9a-f]{40}$'),
  constraint paymaster_grants_hash_format_check
    check (claim_calldata_hash ~ '^0x[0-9a-f]{64}$'),
  constraint paymaster_grants_chain_id_check check (chain_id > 0),
  constraint paymaster_grants_token_id_check check (token_id >= 0),
  constraint paymaster_grants_claim_nonce_check check (claim_nonce >= 0),
  constraint paymaster_grants_stub_calls_check
    check (stub_calls between 0 and 8),
  constraint paymaster_grants_data_calls_check
    check (data_calls between 0 and 1),
  constraint paymaster_grants_expiry_check check (expires_at > created_at)
);

create index if not exists paymaster_grants_expires_at_idx
  on public.paymaster_grants (expires_at);

alter table public.paymaster_grants enable row level security;

revoke all on table public.paymaster_grants from public, anon, authenticated;
grant select, insert, update, delete on table public.paymaster_grants
  to service_role;

-- One active grant is allowed for the same wallet/badge/contract nonce. An
-- expired row can be atomically replaced; an active row cannot be reset by a
-- concurrent voucher request. SECURITY INVOKER is intentional: only the
-- server's service_role can execute the function or reach the table.
create or replace function public.issue_paymaster_grant(
  p_grant_id uuid,
  p_account text,
  p_contract_address text,
  p_chain_id bigint,
  p_token_id numeric,
  p_claim_nonce numeric,
  p_claim_calldata_hash text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_grant_id uuid;
begin
  if p_account !~* '^0x[0-9a-f]{40}$'
    or p_contract_address !~* '^0x[0-9a-f]{40}$'
    or p_claim_calldata_hash !~* '^0x[0-9a-f]{64}$'
    or p_chain_id <= 0
    or p_token_id < 0
    or p_claim_nonce < 0
    or p_expires_at <= v_now
    or p_expires_at > v_now + interval '15 minutes'
  then
    return false;
  end if;

  insert into public.paymaster_grants (
    grant_id,
    account,
    contract_address,
    chain_id,
    token_id,
    claim_nonce,
    claim_calldata_hash,
    expires_at,
    created_at,
    updated_at
  )
  values (
    p_grant_id,
    lower(p_account),
    lower(p_contract_address),
    p_chain_id,
    p_token_id,
    p_claim_nonce,
    lower(p_claim_calldata_hash),
    p_expires_at,
    v_now,
    v_now
  )
  on conflict on constraint paymaster_grants_scope_key do update
  set
    grant_id = excluded.grant_id,
    claim_calldata_hash = excluded.claim_calldata_hash,
    expires_at = excluded.expires_at,
    stub_calls = 0,
    data_calls = 0,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at
  where public.paymaster_grants.expires_at <= v_now
  returning grant_id into v_grant_id;

  return v_grant_id is not null;
end;
$$;

revoke execute on function public.issue_paymaster_grant(
  uuid,
  text,
  text,
  bigint,
  numeric,
  numeric,
  text,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.issue_paymaster_grant(
  uuid,
  text,
  text,
  bigint,
  numeric,
  numeric,
  text,
  timestamptz
) to service_role;

-- Reservation and the corresponding counter increment are one UPDATE. Stub
-- estimation may retry a bounded number of times; final sponsorship data is
-- issued once. A final reservation also closes the stub path.
create or replace function public.reserve_paymaster_grant(
  p_grant_id uuid,
  p_account text,
  p_contract_address text,
  p_chain_id bigint,
  p_token_id numeric,
  p_claim_nonce numeric,
  p_claim_calldata_hash text,
  p_expires_at timestamptz,
  p_request_method text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_grant_id uuid;
begin
  if p_request_method not in (
    'pm_getPaymasterStubData',
    'pm_getPaymasterData'
  ) then
    return false;
  end if;

  update public.paymaster_grants
  set
    stub_calls = stub_calls + case
      when p_request_method = 'pm_getPaymasterStubData' then 1
      else 0
    end,
    data_calls = data_calls + case
      when p_request_method = 'pm_getPaymasterData' then 1
      else 0
    end,
    updated_at = statement_timestamp()
  where grant_id = p_grant_id
    and account = lower(p_account)
    and contract_address = lower(p_contract_address)
    and chain_id = p_chain_id
    and token_id = p_token_id
    and claim_nonce = p_claim_nonce
    and claim_calldata_hash = lower(p_claim_calldata_hash)
    and expires_at = p_expires_at
    and expires_at > statement_timestamp()
    and (
      (
        p_request_method = 'pm_getPaymasterStubData'
        and stub_calls < 8
        and data_calls = 0
      )
      or (
        p_request_method = 'pm_getPaymasterData'
        and data_calls = 0
      )
    )
  returning grant_id into v_grant_id;

  return v_grant_id is not null;
end;
$$;

revoke execute on function public.reserve_paymaster_grant(
  uuid,
  text,
  text,
  bigint,
  numeric,
  numeric,
  text,
  timestamptz,
  text
) from public, anon, authenticated;
grant execute on function public.reserve_paymaster_grant(
  uuid,
  text,
  text,
  bigint,
  numeric,
  numeric,
  text,
  timestamptz,
  text
) to service_role;
