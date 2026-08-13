begin;

-- Older project grants included privileges beyond normal CRUD. RLS does not
-- protect TRUNCATE, so public API roles must retain SELECT only on public
-- activity feeds and no privileges on the private watchlist table.
revoke truncate, references, trigger
  on table public.drawcoins, public.transactions, public.watchlists
  from anon, authenticated;

-- Keep one canonical public-read policy for transactions and no client policy
-- for watchlists. These policy names came from the project's legacy schema.
drop policy if exists "Transactions are viewable by everyone."
  on public.transactions;
drop policy if exists "watchlists_select_public"
  on public.watchlists;

-- This is a trigger-only SECURITY DEFINER function. Existing triggers do not
-- require callers to have EXECUTE, so remove its accidental RPC exposure and
-- pin object resolution to trusted schemas.
do $migration$
begin
  if to_regprocedure('public.handle_new_transaction()') is not null then
    execute 'revoke execute on function public.handle_new_transaction() from public, anon, authenticated';
    execute 'alter function public.handle_new_transaction() set search_path = public, pg_temp';
  end if;
end
$migration$;

commit;
