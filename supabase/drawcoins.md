create table public.drawcoins (
  id uuid not null default gen_random_uuid (),
  name text not null,
  symbol text not null,
  description text not null,
  contract_address text not null,
  image_url text not null,
  category text not null,
  creator_address text not null,
  creator_name text null,
  tx_hash text not null,
  chain_id integer not null default 8453,
  currency text not null default 'ZORA'::text,
  platform_referrer text null,
  total_supply text null,
  current_price text null,
  volume_24h text null,
  holders integer not null default 1,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  creation_type text null default 'hand-drawn'::text,
  watchlist_count integer null default 0,
  constraint drawcoins_pkey primary key (id),
  constraint drawcoins_contract_address_key unique (contract_address),
  constraint drawcoins_creation_type_check check (
    (
      creation_type = any (array['ai'::text, 'hand-drawn'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_drawcoins_creation_type on public.drawcoins using btree (creation_type) TABLESPACE pg_default;

create index IF not exists idx_drawcoins_contract_address on public.drawcoins using btree (contract_address) TABLESPACE pg_default;

create index IF not exists idx_drawcoins_creator_address on public.drawcoins using btree (creator_address) TABLESPACE pg_default;

create index IF not exists idx_drawcoins_category on public.drawcoins using btree (category) TABLESPACE pg_default;

create index IF not exists idx_drawcoins_created_at on public.drawcoins using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_drawcoins_chain_id on public.drawcoins using btree (chain_id) TABLESPACE pg_default;

create index IF not exists idx_drawcoins_search on public.drawcoins using gin (
  to_tsvector(
    'english'::regconfig,
    (
      (((name || ' '::text) || symbol) || ' '::text) || description
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_drawcoins_watchlist_count on public.drawcoins using btree (watchlist_count desc) TABLESPACE pg_default;

create trigger update_drawcoins_updated_at BEFORE
update on drawcoins for EACH row
execute FUNCTION update_updated_at_column ();