create table public.watchlists (
  id uuid not null default gen_random_uuid (),
  user_address text not null,
  token_address text not null,
  added_at timestamp with time zone null default now(),
  added_price_eth numeric null,
  added_price_usd numeric null,
  added_price_timestamp timestamp with time zone null default now(),
  constraint watchlists_pkey primary key (id),
  constraint watchlists_user_address_token_address_key unique (user_address, token_address),
  constraint watchlists_token_address_fkey foreign KEY (token_address) references drawcoins (contract_address),
  constraint watchlists_user_address_fkey foreign KEY (user_address) references users (address)
) TABLESPACE pg_default;

create trigger trigger_decrement_watchlist_count
after DELETE on watchlists for EACH row
execute FUNCTION decrement_watchlist_count ();

create trigger trigger_increment_watchlist_count
after INSERT on watchlists for EACH row
execute FUNCTION increment_watchlist_count ();