create table public.transactions (
  id uuid not null default extensions.uuid_generate_v4 (),
  tx_hash text not null,
  user_address text null,
  token_address text null,
  type public.transaction_type not null,
  amount_token numeric null default 0,
  amount_eth numeric null default 0,
  amount_usd numeric null default 0,
  price_eth numeric null default 0,
  price_usd numeric null default 0,
  timestamp timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint transactions_pkey primary key (id),
  constraint transactions_tx_hash_key unique (tx_hash),
  constraint transactions_token_address_fkey foreign KEY (token_address) references drawcoins (contract_address) on delete CASCADE,
  constraint transactions_user_address_fkey foreign KEY (user_address) references users (address) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_transactions_user on public.transactions using btree (user_address) TABLESPACE pg_default;

create index IF not exists idx_transactions_token on public.transactions using btree (token_address) TABLESPACE pg_default;

create index IF not exists idx_transactions_type on public.transactions using btree (type) TABLESPACE pg_default;

create index IF not exists idx_transactions_timestamp on public.transactions using btree ("timestamp" desc) TABLESPACE pg_default;

create trigger on_new_transaction
after INSERT on transactions for EACH row
execute FUNCTION handle_new_transaction ();

create trigger trigger_update_portfolio
after INSERT on transactions for EACH row
execute FUNCTION update_portfolio_on_transaction ();

create trigger trigger_update_user_stats
after INSERT on transactions for EACH row
execute FUNCTION update_user_stats ();