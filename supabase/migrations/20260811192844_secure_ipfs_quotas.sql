begin;

create schema if not exists drawcoin_private;
revoke all on schema drawcoin_private from public, anon, authenticated;

create table if not exists drawcoin_private.ipfs_upload_rate_limits (
  bucket_key text primary key,
  window_started_at timestamp with time zone not null,
  request_count integer not null default 0,
  image_bytes bigint not null default 0,
  pin_count integer not null default 0,
  updated_at timestamp with time zone not null default now(),
  constraint ipfs_upload_rate_limits_bucket_key_length
    check (char_length(bucket_key) between 1 and 192),
  constraint ipfs_upload_rate_limits_request_count
    check (request_count between 0 and 100000),
  constraint ipfs_upload_rate_limits_image_bytes
    check (image_bytes between 0 and 107374182400),
  constraint ipfs_upload_rate_limits_pin_count
    check (pin_count between 0 and 200000)
);

revoke all on table drawcoin_private.ipfs_upload_rate_limits
from public, anon, authenticated, service_role;

create index if not exists ipfs_upload_rate_limits_updated_at_idx
  on drawcoin_private.ipfs_upload_rate_limits (updated_at);

create or replace function public.reserve_ipfs_upload(
  p_client_key text,
  p_image_bytes integer
)
returns table (
  allowed boolean,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamp with time zone := pg_catalog.clock_timestamp();
  v_keys text[];
  v_window_seconds integer[] := array[86400, 600, 86400, 600];
  v_request_limits integer[] := array[50, 10, 10, 3];
  v_byte_limits bigint[] := array[
    209715200::bigint,
    41943040::bigint,
    41943040::bigint,
    12582912::bigint
  ];
  v_pin_limits integer[] := array[100, 20, 20, 6];
  v_starts timestamp with time zone[] := array[]::timestamp with time zone[];
  v_requests integer[] := array[]::integer[];
  v_bytes bigint[] := array[]::bigint[];
  v_pins integer[] := array[]::integer[];
  v_start timestamp with time zone;
  v_request_count integer;
  v_image_bytes bigint;
  v_pin_count integer;
  v_index integer;
begin
  if p_client_key is null
     or p_client_key !~ '^[0-9a-f]{64}$'
     or p_image_bytes is null
     or p_image_bytes < 1
     or p_image_bytes > 4194304 then
    raise exception 'invalid IPFS upload reservation parameters'
      using errcode = '22023';
  end if;

  v_keys := array[
    'ipfs-upload:global:daily',
    'ipfs-upload:global:10m',
    'ipfs-upload:client:' || p_client_key || ':daily',
    'ipfs-upload:client:' || p_client_key || ':10m'
  ];

  -- Every caller acquires the same global-first lock order. This serializes
  -- global accounting while avoiding cross-wallet deadlocks.
  for v_index in 1..4 loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_keys[v_index], 0)
    );
  end loop;

  -- Validate all four budgets before reserving any of them. A request always
  -- represents one image plus one metadata object (two permanent pins).
  for v_index in 1..4 loop
    select
      limits.window_started_at,
      limits.request_count,
      limits.image_bytes,
      limits.pin_count
    into
      v_start,
      v_request_count,
      v_image_bytes,
      v_pin_count
    from drawcoin_private.ipfs_upload_rate_limits as limits
    where limits.bucket_key = v_keys[v_index];

    if not found
       or v_start + pg_catalog.make_interval(secs => v_window_seconds[v_index])
          <= v_now then
      v_start := v_now;
      v_request_count := 0;
      v_image_bytes := 0;
      v_pin_count := 0;
    end if;

    if v_request_count + 1 > v_request_limits[v_index]
       or v_image_bytes + p_image_bytes > v_byte_limits[v_index]
       or v_pin_count + 2 > v_pin_limits[v_index] then
      allowed := false;
      retry_after_seconds := greatest(
        1,
        pg_catalog.ceil(
          extract(
            epoch from (
              v_start
              + pg_catalog.make_interval(secs => v_window_seconds[v_index])
              - v_now
            )
          )
        )::integer
      );
      return next;
      return;
    end if;

    v_starts[v_index] := v_start;
    v_requests[v_index] := v_request_count;
    v_bytes[v_index] := v_image_bytes;
    v_pins[v_index] := v_pin_count;
  end loop;

  for v_index in 1..4 loop
    insert into drawcoin_private.ipfs_upload_rate_limits (
      bucket_key,
      window_started_at,
      request_count,
      image_bytes,
      pin_count,
      updated_at
    )
    values (
      v_keys[v_index],
      v_starts[v_index],
      v_requests[v_index] + 1,
      v_bytes[v_index] + p_image_bytes,
      v_pins[v_index] + 2,
      v_now
    )
    on conflict (bucket_key) do update
    set
      window_started_at = excluded.window_started_at,
      request_count = excluded.request_count,
      image_bytes = excluded.image_bytes,
      pin_count = excluded.pin_count,
      updated_at = excluded.updated_at;
  end loop;

  delete from drawcoin_private.ipfs_upload_rate_limits as stale
  where stale.bucket_key in (
    select candidates.bucket_key
    from drawcoin_private.ipfs_upload_rate_limits as candidates
    where candidates.updated_at < v_now - interval '2 days'
    order by candidates.updated_at
    limit 100
  );

  allowed := true;
  retry_after_seconds := 0;
  return next;
end;
$function$;

revoke all on function public.reserve_ipfs_upload(text, integer)
from public, anon, authenticated;
grant execute on function public.reserve_ipfs_upload(text, integer)
to service_role;

commit;
