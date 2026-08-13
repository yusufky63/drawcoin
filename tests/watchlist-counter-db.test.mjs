import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pgliteModuleUrl = process.env.PGLITE_MODULE_URL;

test(
  "watchlist counters reconcile legacy drift and remain exact",
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
          id bigint primary key,
          contract_address text not null unique,
          watchlist_count integer
        );

        create table public.watchlists (
          id bigint primary key,
          user_address text not null,
          token_address text not null
        );

        insert into public.drawcoins (
          id,
          contract_address,
          watchlist_count
        ) values
          (1, '0xAaAa', 99),
          (2, '0xBbBb', 7),
          (3, '0xCcCc', null);

        insert into public.watchlists (id, user_address, token_address) values
          (1, 'user-1', '0xaaaa'),
          (2, 'user-2', '0xAAAA'),
          (3, 'user-3', '0xcccc');

        create function public.increment_watchlist_count()
        returns trigger
        language plpgsql
        as $function$
        begin
          update public.drawcoins
          set watchlist_count = watchlist_count + 1
          where contract_address = new.token_address;
          return new;
        end;
        $function$;

        create function public.decrement_watchlist_count()
        returns trigger
        language plpgsql
        as $function$
        begin
          update public.drawcoins
          set watchlist_count = watchlist_count - 1
          where contract_address = old.token_address;
          return old;
        end;
        $function$;

        create trigger trigger_increment_watchlist_count
          after insert on public.watchlists
          for each row execute function public.increment_watchlist_count();

        create trigger trigger_decrement_watchlist_count
          after delete on public.watchlists
          for each row execute function public.decrement_watchlist_count();

        alter table public.drawcoins enable row level security;
        alter table public.watchlists enable row level security;

        create policy "DrawCoins are publicly readable"
          on public.drawcoins
          for select
          to anon, authenticated
          using (true);

        grant usage on schema public to anon, authenticated, service_role;
        grant select on table public.drawcoins to anon, authenticated;
        grant select, insert, update, delete
          on table public.drawcoins, public.watchlists
          to service_role;
      `);

      const migration = await readFile(
        new URL(
          "../supabase/migrations/20260812125310_reconcile_watchlist_counters.sql",
          import.meta.url
        ),
        "utf8"
      );
      await db.exec(migration);

      const reconciled = await db.query(`
        select id, watchlist_count
        from public.drawcoins
        order by id;
      `);
      assert.deepEqual(reconciled.rows, [
        { id: 1, watchlist_count: 2 },
        { id: 2, watchlist_count: 0 },
        { id: 3, watchlist_count: 1 },
      ]);

      await db.exec(`
        insert into public.drawcoins (id, contract_address)
        values (4, '0xDdDd');
      `);
      const defaultCounter = await db.query(`
        select watchlist_count
        from public.drawcoins
        where id = 4;
      `);
      assert.equal(defaultCounter.rows[0].watchlist_count, 0);

      await assert.rejects(
        db.query(`
          insert into public.drawcoins (
            id,
            contract_address,
            watchlist_count
          ) values (5, '0xEeEe', null);
        `),
        /not-null constraint/
      );
      await assert.rejects(
        db.query(`
          update public.drawcoins
          set watchlist_count = null
          where id = 4;
        `),
        /not-null constraint/
      );

      const security = await db.query(`
        select
          not has_function_privilege(
            'anon',
            'public.get_watchlist_counts(text[])',
            'EXECUTE'
          ) as anon_execute_revoked,
          not has_function_privilege(
            'authenticated',
            'public.get_watchlist_counts(text[])',
            'EXECUTE'
          ) as authenticated_execute_revoked,
          has_function_privilege(
            'service_role',
            'public.get_watchlist_counts(text[])',
            'EXECUTE'
          ) as service_execute_granted,
          not has_function_privilege(
            'anon',
            'public.increment_watchlist_count()',
            'EXECUTE'
          ) as anon_trigger_execute_revoked,
          not p.prosecdef as security_invoker,
          p.provolatile = 's' as stable,
          p.proconfig = array['search_path=""']::text[] as empty_search_path
        from pg_catalog.pg_proc as p
        join pg_catalog.pg_namespace as n
          on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'get_watchlist_counts';
      `);
      assert.deepEqual(security.rows[0], {
        anon_execute_revoked: true,
        authenticated_execute_revoked: true,
        service_execute_granted: true,
        anon_trigger_execute_revoked: true,
        security_invoker: true,
        stable: true,
        empty_search_path: true,
      });

      const boundaries = await db.query(`
        select
          c.relrowsecurity as watchlists_rls_enabled,
          has_table_privilege(
            'anon',
            'public.drawcoins',
            'SELECT'
          ) as anon_drawcoins_read_preserved,
          not has_table_privilege(
            'anon',
            'public.watchlists',
            'SELECT'
          ) as anon_watchlists_private,
          not has_table_privilege(
            'authenticated',
            'public.watchlists',
            'SELECT'
          ) as authenticated_watchlists_private,
          has_table_privilege(
            'service_role',
            'public.watchlists',
            'SELECT,INSERT,UPDATE,DELETE'
          ) as service_watchlists_access_preserved,
          (
            select count(*)::integer
            from pg_catalog.pg_policies
            where schemaname = 'public'
              and tablename = 'watchlists'
          ) as watchlists_policy_count
        from pg_catalog.pg_class as c
        join pg_catalog.pg_namespace as n
          on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = 'watchlists';
      `);
      assert.deepEqual(boundaries.rows[0], {
        watchlists_rls_enabled: true,
        anon_drawcoins_read_preserved: true,
        anon_watchlists_private: true,
        authenticated_watchlists_private: true,
        service_watchlists_access_preserved: true,
        watchlists_policy_count: 0,
      });

      const databaseObjects = await db.query(`
        select
          (
            select count(*)::integer = 3
            from pg_catalog.pg_trigger as trigger
            join pg_catalog.pg_class as relation
              on relation.oid = trigger.tgrelid
            join pg_catalog.pg_namespace as namespace
              on namespace.oid = relation.relnamespace
            where namespace.nspname = 'public'
              and relation.relname = 'watchlists'
              and not trigger.tgisinternal
              and trigger.tgname in (
                'trigger_increment_watchlist_count',
                'trigger_decrement_watchlist_count',
                'trigger_update_watchlist_count'
              )
          ) as all_counter_triggers_exist,
          (
            select count(*)::integer = 2
            from pg_catalog.pg_indexes
            where schemaname = 'public'
              and indexname in (
                'watchlists_token_address_lower_idx',
                'drawcoins_contract_address_lower_idx'
              )
          ) as lower_indexes_exist;
      `);
      assert.deepEqual(databaseObjects.rows[0], {
        all_counter_triggers_exist: true,
        lower_indexes_exist: true,
      });

      await db.exec("set role anon");
      await assert.rejects(
        db.query(
          "select * from public.get_watchlist_counts(array['0xaaaa']::text[])"
        ),
        /permission denied/
      );

      await db.exec("reset role; set role service_role");
      const rpcCounts = await db.query(`
        select token_address, watchlist_count
        from public.get_watchlist_counts(
          array['0xAAAA', '0xaaaa', '0xBBBB', ' ', null]::text[]
        );
      `);
      assert.deepEqual(
        rpcCounts.rows.map((row) => ({
          token_address: row.token_address,
          watchlist_count: Number(row.watchlist_count),
        })),
        [
          { token_address: "0xAAAA", watchlist_count: 2 },
          { token_address: "0xBBBB", watchlist_count: 0 },
        ]
      );

      await db.exec(`
        insert into public.watchlists (id, user_address, token_address)
        values (4, 'user-4', '0xAaaa');
      `);
      let counters = await db.query(`
        select contract_address, watchlist_count
        from public.drawcoins
        where id in (1, 2)
        order by id;
      `);
      assert.deepEqual(counters.rows, [
        { contract_address: "0xAaAa", watchlist_count: 3 },
        { contract_address: "0xBbBb", watchlist_count: 0 },
      ]);

      await db.exec(`
        update public.watchlists
        set token_address = '0xBBBB'
        where id = 4;
      `);
      counters = await db.query(`
        select contract_address, watchlist_count
        from public.drawcoins
        where id in (1, 2)
        order by id;
      `);
      assert.deepEqual(counters.rows, [
        { contract_address: "0xAaAa", watchlist_count: 2 },
        { contract_address: "0xBbBb", watchlist_count: 1 },
      ]);

      await db.exec(`
        update public.watchlists
        set token_address = '0xbbbb'
        where id = 4;

        delete from public.watchlists
        where id = 4;
      `);
      counters = await db.query(`
        select contract_address, watchlist_count
        from public.drawcoins
        where id in (1, 2)
        order by id;
      `);
      assert.deepEqual(counters.rows, [
        { contract_address: "0xAaAa", watchlist_count: 2 },
        { contract_address: "0xBbBb", watchlist_count: 0 },
      ]);

      await db.exec(`
        insert into public.watchlists (id, user_address, token_address)
        values (5, 'user-5', '0xBBBB');

        -- Simulate a legacy zero immediately before a delete. The trigger must
        -- repair toward zero rather than underflowing to a negative value.
        update public.drawcoins
        set watchlist_count = 0
        where id = 2;

        delete from public.watchlists
        where id = 5;
      `);
      const nonNegative = await db.query(`
        select watchlist_count
        from public.drawcoins
        where id = 2;
      `);
      assert.equal(nonNegative.rows[0].watchlist_count, 0);

      await assert.rejects(
        db.query(`
          update public.drawcoins
          set watchlist_count = -1
          where id = 2;
        `),
        /drawcoins_watchlist_count_nonnegative/
      );

      await db.exec("reset role");
    } finally {
      await db.close();
    }
  }
);
