create table public.users (
  address text not null,
  username text null,
  avatar_url text null,
  total_volume_usd numeric null default 0,
  total_trades integer null default 0,
  coins_created integer null default 0,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  last_active timestamp with time zone null default timezone ('utc'::text, now()),
  daily_ai_usage integer null default 0,
  last_reset_date timestamp with time zone null default now(),
  total_buy_volume numeric null default 0,
  constraint users_pkey primary key (address)
) TABLESPACE pg_default;