import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pgliteModuleUrl = process.env.PGLITE_MODULE_URL;

test(
  "legacy advisor hardening preserves reads and removes browser writes",
  { skip: !pgliteModuleUrl },
  async () => {
    const { PGlite } = await import(pgliteModuleUrl);
    const db = new PGlite();

    try {
      await db.exec(`
        create role anon nologin;
        create role authenticated nologin;
        create role service_role nologin bypassrls;

        create table public.drawcoins (
          contract_address text primary key,
          watchlist_count integer
        );
        create table public.watchlists (
          id bigint generated always as identity primary key,
          token_address text references public.drawcoins(contract_address)
        );
        create table public.portfolio (
          id bigint generated always as identity primary key,
          user_address text not null,
          token_address text not null
        );

        alter table public.portfolio enable row level security;
        create policy "Portfolio is viewable by everyone."
          on public.portfolio for select using (true);
        create policy "Users can update their own portfolio."
          on public.portfolio for all using (true);
        grant all on table public.portfolio to anon, authenticated, service_role;

        create function public.increment_watchlist_count()
        returns trigger language plpgsql as $$ begin return new; end $$;
        create function public.decrement_watchlist_count()
        returns trigger language plpgsql as $$ begin return old; end $$;
        create function public.update_updated_at_column()
        returns trigger language plpgsql as $$ begin return new; end $$;
        create function public.update_user_stats()
        returns trigger language plpgsql as $$ begin return new; end $$;
        create function public.update_portfolio_on_transaction()
        returns trigger language plpgsql as $$ begin return new; end $$;

        create trigger watchlist_count_insert
          after insert on public.watchlists
          for each row execute function public.increment_watchlist_count();
        create trigger watchlist_count_delete
          after delete on public.watchlists
          for each row execute function public.decrement_watchlist_count();
      `);

      const migration = await readFile(
        new URL(
          "../supabase/migrations/20260811190214_harden_legacy_database_advisors.sql",
          import.meta.url
        ),
        "utf8"
      );
      await db.exec(migration);

      const result = await db.query(`
        select
          not exists (
            select 1 from pg_policies
            where schemaname = 'public'
              and tablename = 'portfolio'
              and policyname = 'Users can update their own portfolio.'
          ) as unsafe_policy_removed,
          has_table_privilege('anon', 'public.portfolio', 'SELECT')
            as anon_read_preserved,
          not has_table_privilege('anon', 'public.portfolio', 'INSERT')
            as anon_write_removed,
          not has_table_privilege('authenticated', 'public.portfolio', 'UPDATE')
            as authenticated_write_removed,
          exists (
            select 1 from pg_indexes
            where schemaname = 'public'
              and tablename = 'watchlists'
              and indexname = 'idx_watchlists_token_address'
          ) as foreign_key_index_exists,
          (
            select count(*) = 5
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname in (
                'update_updated_at_column',
                'update_user_stats',
                'update_portfolio_on_transaction',
                'increment_watchlist_count',
                'decrement_watchlist_count'
              )
              and array_to_string(p.proconfig, ',') = 'search_path=""'
          ) as function_paths_hardened
      `);

      assert.deepEqual(result.rows[0], {
        unsafe_policy_removed: true,
        anon_read_preserved: true,
        anon_write_removed: true,
        authenticated_write_removed: true,
        foreign_key_index_exists: true,
        function_paths_hardened: true,
      });

      await db.exec(`
        insert into public.drawcoins(contract_address, watchlist_count)
        values ('0x1', null);
        insert into public.watchlists(token_address) values ('0x1');
      `);
      let count = await db.query(
        "select watchlist_count from public.drawcoins where contract_address = '0x1'"
      );
      assert.equal(count.rows[0].watchlist_count, 1);

      await db.exec("delete from public.watchlists where token_address = '0x1'");
      count = await db.query(
        "select watchlist_count from public.drawcoins where contract_address = '0x1'"
      );
      assert.equal(count.rows[0].watchlist_count, 0);
    } finally {
      await db.close();
    }
  }
);
