begin;

-- Public profile and aggregate rows remain readable, but all writes are
-- produced by verified server routes and database triggers. The former
-- permissive policies allowed an anonymous Data API client to impersonate any
-- wallet and rewrite leaderboard statistics.
alter table public.users enable row level security;
alter table public.platform_stats enable row level security;

drop policy if exists "Users can insert their own profile." on public.users;
drop policy if exists "Users can update own profile." on public.users;
drop policy if exists "Platform stats can be inserted by system." on public.platform_stats;

revoke all privileges on table public.users from public, anon, authenticated;
revoke all privileges on table public.platform_stats from public, anon, authenticated;

grant select on table public.users to anon, authenticated;
grant select on table public.platform_stats to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on table public.users, public.platform_stats
  to service_role;

-- Trigger helpers are not application RPCs. They continue to run from their
-- owning triggers, while direct Data API execution is denied.
revoke execute on function public.update_user_stats() from public, anon, authenticated;
revoke execute on function public.update_portfolio_on_transaction() from public, anon, authenticated;
revoke execute on function public.update_updated_at_column() from public, anon, authenticated;
grant execute on function public.update_user_stats() to service_role;
grant execute on function public.update_portfolio_on_transaction() to service_role;
grant execute on function public.update_updated_at_column() to service_role;

-- Opt in to Supabase's explicit-grant model for objects created by future
-- migrations. Every new API surface must declare its grants and RLS policy in
-- the same migration instead of becoming reachable by default.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete, truncate, references, trigger
  on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select, update on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;

commit;
