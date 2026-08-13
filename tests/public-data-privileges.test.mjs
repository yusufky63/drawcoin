import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pgliteModuleUrl = process.env.PGLITE_MODULE_URL;

test(
  "public profile data is read-only and future API grants are explicit",
  { skip: !pgliteModuleUrl },
  async () => {
    const { PGlite } = await import(pgliteModuleUrl);
    const db = new PGlite();

    try {
      await db.exec(`
        create role anon nologin;
        create role authenticated nologin;
        create role service_role nologin bypassrls;

        create table public.users (
          address text primary key,
          total_trades integer default 0
        );
        create table public.platform_stats (
          id integer primary key,
          total_trades integer default 0
        );
        create table public.portfolio (id bigint primary key);

        alter table public.users enable row level security;
        alter table public.platform_stats enable row level security;

        create policy "Public users are viewable by everyone."
          on public.users for select using (true);
        create policy "Users can insert their own profile."
          on public.users for insert with check (true);
        create policy "Users can update own profile."
          on public.users for update using (true);
        create policy "Platform stats are viewable by everyone."
          on public.platform_stats for select using (true);
        create policy "Platform stats can be inserted by system."
          on public.platform_stats for insert with check (true);

        grant all on table public.users, public.platform_stats
          to anon, authenticated, service_role;

        create function public.update_user_stats()
        returns trigger language plpgsql as $fn$ begin return new; end $fn$;
        create function public.update_portfolio_on_transaction()
        returns trigger language plpgsql as $fn$ begin return new; end $fn$;
        create function public.update_updated_at_column()
        returns trigger language plpgsql as $fn$ begin return new; end $fn$;
      `);

      const migration = await readFile(
        new URL(
          "../supabase/migrations/20260813161215_harden_public_user_stats_privileges.sql",
          import.meta.url
        ),
        "utf8"
      );
      await db.exec(migration);
      const maintainMigration = await readFile(
        new URL(
          "../supabase/migrations/20260813161902_revoke_future_maintain_privileges.sql",
          import.meta.url
        ),
        "utf8"
      );
      await db.exec(maintainMigration);

      const boundaries = await db.query(`
        select
          has_table_privilege('anon', 'public.users', 'SELECT')
            as anon_users_read,
          not has_table_privilege('anon', 'public.users', 'INSERT,UPDATE,DELETE')
            as anon_users_write_denied,
          has_table_privilege('authenticated', 'public.platform_stats', 'SELECT')
            as auth_stats_read,
          not has_table_privilege('authenticated', 'public.platform_stats', 'INSERT,UPDATE,DELETE')
            as auth_stats_write_denied,
          has_table_privilege('service_role', 'public.users', 'SELECT,INSERT,UPDATE,DELETE')
            as service_users_write,
          not has_function_privilege('anon', 'public.update_user_stats()', 'EXECUTE')
            as anon_trigger_rpc_denied,
          has_function_privilege('service_role', 'public.update_user_stats()', 'EXECUTE')
            as service_trigger_access;
      `);
      assert.deepEqual(boundaries.rows[0], {
        anon_users_read: true,
        anon_users_write_denied: true,
        auth_stats_read: true,
        auth_stats_write_denied: true,
        service_users_write: true,
        anon_trigger_rpc_denied: true,
        service_trigger_access: true,
      });

      const writePolicies = await db.query(`
        select count(*)::integer as count
        from pg_catalog.pg_policies
        where schemaname = 'public'
          and tablename in ('users', 'platform_stats')
          and cmd <> 'SELECT';
      `);
      assert.equal(writePolicies.rows[0].count, 0);

      await db.exec(`
        create table public.future_api_surface (id bigint primary key);
        create function public.future_api_function()
        returns integer language sql as $fn$ select 1 $fn$;
      `);
      const defaults = await db.query(`
        select
          not has_table_privilege('anon', 'public.future_api_surface', 'SELECT')
            as future_table_private,
          not has_table_privilege('anon', 'public.future_api_surface', 'MAINTAIN')
            as future_table_maintain_private,
          not has_table_privilege('service_role', 'public.future_api_surface', 'MAINTAIN')
            as future_service_maintain_explicit;
      `);
      assert.deepEqual(defaults.rows[0], {
        future_table_private: true,
        future_table_maintain_private: true,
        future_service_maintain_explicit: true,
      });

      // PGlite currently models the built-in PUBLIC function EXECUTE default
      // differently from hosted Postgres. The migration still carries the
      // documented explicit default-privilege revocation; hosted verification
      // checks it after apply.
    } finally {
      await db.close();
    }
  }
);
