import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pgliteModuleUrl = process.env.PGLITE_MODULE_URL;
const migrationFiles = [
  "20260811173317_create_draw_missions.sql",
  "20260811173342_reconcile_onchain_badge_claims.sql",
  "20260811173355_secure_paymaster_grants.sql",
  "20260811173610_harden_legacy_activity_privileges.sql",
  "20260811202443_redefine_first_stroke_verified_creation.sql",
  "20260813163658_expand_verified_missions.sql",
  "20260814130948_replace_curator_with_trade_missions.sql",
];

test(
  "mission, reconciliation, and paymaster migrations preserve RLS boundaries",
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
          id bigint generated always as identity primary key,
          creator_address text,
          contract_address text,
          creation_type text,
          tx_hash text,
          chain_id bigint default 8453,
          platform_referrer text,
          created_at timestamptz default now()
        );
        create table public.transactions (
          id bigint generated always as identity primary key,
          user_address text,
          token_address text,
          tx_hash text,
          type text,
          timestamp timestamptz default now()
        );
        create table public.watchlists (
          id bigint generated always as identity primary key,
          user_address text,
          token_address text
        );

        grant all on table public.drawcoins, public.transactions, public.watchlists
          to anon, authenticated;

        alter table public.transactions enable row level security;
        create policy "Transactions are viewable by everyone."
          on public.transactions for select using (true);

        alter table public.watchlists enable row level security;
        create policy "watchlists_select_public"
          on public.watchlists for select using (true);

        create function public.handle_new_transaction()
        returns trigger
        language plpgsql
        security definer
        as $function$
        begin
          return new;
        end
        $function$;

        create trigger on_new_transaction
          after insert on public.transactions
          for each row execute function public.handle_new_transaction();
      `);

      for (const fileName of migrationFiles) {
        const sql = await readFile(
          new URL(`../supabase/migrations/${fileName}`, import.meta.url),
          "utf8"
        );
        await db.exec(sql);
      }

      const security = await db.query(`
        select
          has_table_privilege('anon', 'public.mission_definitions', 'SELECT')
            as anon_catalog_read,
          has_table_privilege('anon', 'public.user_missions', 'SELECT')
            as anon_progress_read,
          has_table_privilege('authenticated', 'public.user_badges', 'UPDATE')
            as user_badge_write,
          has_table_privilege('anon', 'public.watchlists', 'SELECT')
            as anon_watchlist_read,
          has_table_privilege('anon', 'public.drawcoins', 'INSERT')
            as anon_coin_write,
          has_table_privilege('anon', 'public.transactions', 'INSERT')
            as anon_transaction_write,
          has_table_privilege('anon', 'public.drawcoins', 'TRUNCATE')
            as anon_coin_truncate,
          has_table_privilege('authenticated', 'public.transactions', 'TRIGGER')
            as authenticated_transaction_trigger,
          has_table_privilege('anon', 'public.watchlists', 'REFERENCES')
            as anon_watchlist_references,
          has_table_privilege('anon', 'public.paymaster_grants', 'SELECT')
            as anon_grant_read,
          has_table_privilege('anon', 'public.activity_verifications', 'SELECT')
            as anon_activity_proof_read,
          has_function_privilege(
            'anon',
            'public.issue_siwe_nonce(text,text,timestamp with time zone)',
            'EXECUTE'
          ) as anon_nonce_execute,
          has_function_privilege(
            'service_role',
            'public.issue_siwe_nonce(text,text,timestamp with time zone)',
            'EXECUTE'
          ) as service_nonce_execute,
          has_function_privilege(
            'anon',
            'public.reserve_paymaster_grant(uuid,text,text,bigint,numeric,numeric,text,timestamp with time zone,text)',
            'EXECUTE'
          ) as anon_grant_execute,
          has_function_privilege(
            'service_role',
            'public.reserve_paymaster_grant(uuid,text,text,bigint,numeric,numeric,text,timestamp with time zone,text)',
            'EXECUTE'
          ) as service_grant_execute,
          has_function_privilege(
            'anon',
            'public.handle_new_transaction()',
            'EXECUTE'
          ) as anon_trigger_execute,
          has_function_privilege(
            'authenticated',
            'public.handle_new_transaction()',
            'EXECUTE'
          ) as authenticated_trigger_execute,
          has_function_privilege(
            'anon',
            'public.commit_legacy_activity_verification(text,text,bigint,text,bigint,integer,text,timestamp with time zone)',
            'EXECUTE'
          ) as anon_legacy_commit_execute,
          has_function_privilege(
            'service_role',
            'public.commit_legacy_activity_verification(text,text,bigint,text,bigint,integer,text,timestamp with time zone)',
            'EXECUTE'
          ) as service_legacy_commit_execute,
          has_function_privilege(
            'anon',
            'public.reconfirm_legacy_watchlists(text)',
            'EXECUTE'
          ) as anon_watchlist_reconfirm_execute,
          has_function_privilege(
            'service_role',
            'public.reconfirm_legacy_watchlists(text)',
            'EXECUTE'
          ) as service_watchlist_reconfirm_execute;
      `);
      assert.deepEqual(security.rows[0], {
        anon_catalog_read: true,
        anon_progress_read: false,
        user_badge_write: false,
        anon_watchlist_read: false,
        anon_coin_write: false,
        anon_transaction_write: false,
        anon_coin_truncate: false,
        authenticated_transaction_trigger: false,
        anon_watchlist_references: false,
        anon_grant_read: false,
        anon_activity_proof_read: false,
        anon_nonce_execute: false,
        service_nonce_execute: true,
        anon_grant_execute: false,
        service_grant_execute: true,
        anon_trigger_execute: false,
        authenticated_trigger_execute: false,
        anon_legacy_commit_execute: false,
        service_legacy_commit_execute: true,
        anon_watchlist_reconfirm_execute: false,
        service_watchlist_reconfirm_execute: true,
      });

      const legacyPolicyCleanup = await db.query(`
        select count(*)::integer as policy_count
        from pg_policies
        where schemaname = 'public'
          and (
            (tablename = 'transactions' and policyname = 'Transactions are viewable by everyone.')
            or (tablename = 'watchlists' and policyname = 'watchlists_select_public')
          );
      `);
      assert.equal(legacyPolicyCleanup.rows[0].policy_count, 0);

      const triggerFunctionConfig = await db.query(`
        select proconfig
        from pg_proc
        join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
        where nspname = 'public'
          and proname = 'handle_new_transaction';
      `);
      assert.deepEqual(triggerFunctionConfig.rows[0].proconfig, [
        "search_path=public, pg_temp",
      ]);

      const rls = await db.query(`
        select relname, relrowsecurity
        from pg_catalog.pg_class
        join pg_catalog.pg_namespace
          on pg_catalog.pg_namespace.oid = pg_catalog.pg_class.relnamespace
        where nspname = 'public'
          and relname in (
            'drawcoins',
            'transactions',
            'watchlists',
            'siwe_nonces',
            'siwe_nonce_rate_limits',
            'mission_definitions',
            'user_missions',
            'user_badges',
            'paymaster_grants',
            'activity_verifications'
          )
        order by relname;
      `);
      assert.equal(rls.rows.length, 10);
      assert.ok(rls.rows.every((row) => row.relrowsecurity === true));

      const notificationColumn = await db.query(`
        select is_nullable
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'user_badges'
          and column_name = 'notification_attempted_at';
      `);
      assert.equal(notificationColumn.rows[0].is_nullable, "YES");

      const firstStroke = await db.query(`
        select metric, description, badge_description
        from public.mission_definitions
        where slug = 'first-stroke';
      `);
      assert.deepEqual(firstStroke.rows[0], {
        metric: "verified_creation",
        description: "Create your first verified DrawCoin on Base.",
        badge_description: "Awarded for creating a verified DrawCoin on Base.",
      });
      await assert.rejects(() =>
        db.query(`
          update public.mission_definitions
          set metric = 'hand_drawn_coin'
          where slug = 'first-stroke';
        `)
      );

      await db.exec("set role anon");
      const catalog = await db.query(`
        select slug
        from public.mission_definitions
        where is_active = true
        order by sort_order;
      `);
      assert.deepEqual(
        catalog.rows.map((row) => row.slug),
        [
          "first-stroke",
          "collector",
          "creator-journey",
          "ecosystem-builder",
          "base-regular",
          "active-trader",
          "diverse-collector",
          "round-trip",
          "trader-veteran",
          "market-regular",
          "badge-hunter",
          "badge-master",
        ]
      );
      await db.exec("reset role");
      const archivedCurator = await db.query(`
        select is_active, badge_token_id
        from public.mission_definitions
        where slug = 'curator';
      `);
      assert.deepEqual(archivedCurator.rows[0], {
        is_active: false,
        badge_token_id: 3,
      });
      await db.exec("set role anon");
      await assert.rejects(() => db.query("select * from public.user_badges"));

      await db.exec(`
        reset role;
        insert into public.drawcoins (
          creator_address,
          contract_address,
          creation_type,
          tx_hash,
          chain_id,
          verified_at
        ) values (
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
          'hand-drawn',
          '0x${"a".repeat(64)}',
          8453,
          null
        );
        insert into public.watchlists (
          user_address,
          token_address,
          verified_at
        ) values (
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
          null
        );
        set role service_role;
      `);

      const legacyCoin = await db.query(`
        select id::text as id
        from public.drawcoins
        where contract_address = '0x2222222222222222222222222222222222222222';
      `);
      const firstCommit = await db.query(`
        select public.commit_legacy_activity_verification(
          'drawcoin',
          '${legacyCoin.rows[0].id}',
          8453,
          '0x${"a".repeat(64)}',
          42,
          3,
          'CoinCreatedV4',
          '2026-08-10T10:00:00.000Z'
        ) as committed;
      `);
      assert.equal(firstCommit.rows[0].committed, true);
      const repeatedCommit = await db.query(`
        select public.commit_legacy_activity_verification(
          'drawcoin',
          '${legacyCoin.rows[0].id}',
          8453,
          '0x${"a".repeat(64)}',
          42,
          3,
          'CoinCreatedV4',
          '2026-08-10T10:00:00.000Z'
        ) as committed;
      `);
      assert.equal(repeatedCommit.rows[0].committed, false);

      const reconfirmed = await db.query(`
        select * from public.reconfirm_legacy_watchlists(
          '0x1111111111111111111111111111111111111111'
        );
      `);
      assert.equal(Number(reconfirmed.rows[0].confirmed_count), 1);
      assert.equal(Number(reconfirmed.rows[0].remaining_count), 0);

      const nonce = await db.query(`
        select * from public.issue_siwe_nonce(
          repeat('a', 64),
          repeat('b', 64),
          statement_timestamp() + interval '5 minutes'
        );
      `);
      assert.equal(nonce.rows[0].allowed, true);

      const grant = await db.query(`
        select public.issue_paymaster_grant(
          '33333333-3333-4333-8333-333333333333',
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
          84532,
          1,
          7,
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          statement_timestamp() + interval '5 minutes'
        ) as allowed;
      `);
      assert.equal(grant.rows[0].allowed, true);
    } finally {
      await db.close();
    }
  }
);
