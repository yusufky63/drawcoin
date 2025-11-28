create table public.portfolio (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_address text null,
  token_address text null,
  balance numeric null default 0,
  average_buy_price_usd numeric null default 0,
  total_invested_usd numeric null default 0,
  realized_pnl_usd numeric null default 0,
  last_updated timestamp with time zone null default timezone ('utc'::text, now()),
  constraint portfolio_pkey primary key (id),
  constraint portfolio_user_address_token_address_key unique (user_address, token_address),
  constraint portfolio_token_address_fkey foreign KEY (token_address) references drawcoins (contract_address) on delete CASCADE,
  constraint portfolio_user_address_fkey foreign KEY (user_address) references users (address) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_portfolio_user on public.portfolio using btree (user_address) TABLESPACE pg_default;

create index IF not exists idx_portfolio_token on public.portfolio using btree (token_address) TABLESPACE pg_default;

create index IF not exists idx_portfolio_balance on public.portfolio using btree (balance) TABLESPACE pg_default
where
  (balance > (0)::numeric);