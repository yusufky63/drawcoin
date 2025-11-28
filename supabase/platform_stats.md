create table public.platform_stats (
  id integer not null default 1,
  total_volume_usd numeric null default 0,
  total_trades integer null default 0,
  total_coins_created integer null default 0,
  updated_at timestamp with time zone null default timezone ('utc'::text, now()),
  total_users integer null default 0,
  total_unique_traders integer null default 0,
  total_volume_24h numeric null default 0,
  top_coin_address text null,
  constraint platform_stats_pkey primary key (id),
  constraint single_row check ((id = 1))
) TABLESPACE pg_default;