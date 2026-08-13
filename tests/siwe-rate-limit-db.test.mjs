import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pgliteModuleUrl = process.env.PGLITE_MODULE_URL;

test(
  "SIWE nonce issuance is bounded, private, and service-role only",
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
          creation_type text
        );
        create table public.transactions (
          id bigint generated always as identity primary key,
          user_address text,
          type text
        );
        create table public.watchlists (
          id bigint generated always as identity primary key,
          user_address text,
          token_address text
        );
      `);

      const migration = await readFile(
        new URL(
          "../supabase/migrations/20260811173317_create_draw_missions.sql",
          import.meta.url
        ),
        "utf8"
      );
      await db.exec(migration);

      const security = await db.query(`
        select
          has_function_privilege(
            'anon',
            'public.issue_siwe_nonce(text,text,timestamp with time zone)',
            'EXECUTE'
          ) as anon_execute,
          has_function_privilege(
            'service_role',
            'public.issue_siwe_nonce(text,text,timestamp with time zone)',
            'EXECUTE'
          ) as service_execute,
          has_table_privilege(
            'anon',
            'public.siwe_nonce_rate_limits',
            'SELECT'
          ) as anon_read,
          has_table_privilege(
            'service_role',
            'public.siwe_nonces',
            'SELECT,INSERT,UPDATE,DELETE'
          ) as service_nonce_access,
          c.relrowsecurity as rls_enabled,
          p.prosecdef as security_definer,
          p.proconfig as function_config,
          r.rolbypassrls as service_bypasses_rls
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        cross join pg_catalog.pg_proc p
        join pg_catalog.pg_namespace pn on pn.oid = p.pronamespace
        cross join pg_catalog.pg_roles r
        where n.nspname = 'public'
          and c.relname = 'siwe_nonce_rate_limits'
          and pn.nspname = 'public'
          and p.proname = 'issue_siwe_nonce'
          and r.rolname = 'service_role';
      `);
      const securityRow = security.rows[0];
      assert.equal(securityRow.anon_execute, false);
      assert.equal(securityRow.service_execute, true);
      assert.equal(securityRow.anon_read, false);
      assert.equal(securityRow.service_nonce_access, true);
      assert.equal(securityRow.rls_enabled, true);
      assert.equal(securityRow.security_definer, false);
      assert.equal(securityRow.service_bypasses_rls, true);
      assert.ok(
        securityRow.function_config.some((value) =>
          value.startsWith("search_path=")
        )
      );

      const internalSecurity = await db.query(`
        select
          has_schema_privilege(
            'anon',
            'drawcoin_private',
            'USAGE'
          ) as anon_schema_usage,
          has_schema_privilege(
            'service_role',
            'drawcoin_private',
            'USAGE'
          ) as service_schema_usage,
          has_function_privilege(
            'anon',
            'drawcoin_private.issue_siwe_nonce_internal(text,text,timestamp with time zone)',
            'EXECUTE'
          ) as anon_internal_execute,
          has_function_privilege(
            'service_role',
            'drawcoin_private.issue_siwe_nonce_internal(text,text,timestamp with time zone)',
            'EXECUTE'
          ) as service_internal_execute,
          p.prosecdef as security_definer,
          p.proconfig as function_config
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'drawcoin_private'
          and p.proname = 'issue_siwe_nonce_internal';
      `);
      const internalRow = internalSecurity.rows[0];
      assert.equal(internalRow.anon_schema_usage, false);
      assert.equal(internalRow.service_schema_usage, true);
      assert.equal(internalRow.anon_internal_execute, false);
      assert.equal(internalRow.service_internal_execute, true);
      assert.equal(internalRow.security_definer, true);
      assert.ok(
        internalRow.function_config.some((value) =>
          value.startsWith("search_path=")
        )
      );

      const columns = await db.query(`
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'siwe_nonce_rate_limits'
        order by ordinal_position;
      `);
      assert.deepEqual(
        columns.rows.map((row) => row.column_name),
        ["client_hash", "request_count", "window_started_at", "reset_at"]
      );

      await db.exec("set role service_role");
      const clientHash = "b".repeat(64);
      const issue = async (seed, client = clientHash) => {
        const nonceHash = seed.toString(16).padStart(64, "0");
        const result = await db.query(
          `select * from public.issue_siwe_nonce(
            $1,
            $2,
            clock_timestamp() + interval '5 minutes'
          )`,
          [nonceHash, client]
        );
        return result.rows[0];
      };

      assert.equal((await issue(1)).allowed, true);
      assert.equal((await issue(2)).allowed, true);
      assert.equal((await issue(3)).allowed, true);
      const activeLimited = await issue(4);
      assert.equal(activeLimited.allowed, false);
      assert.equal(activeLimited.reason, "active_limit");
      assert.ok(activeLimited.retry_after_seconds >= 1);

      await db.exec("reset role");
      await db.query(
        "delete from public.siwe_nonces where client_hash = $1",
        [clientHash]
      );
      await db.exec("set role service_role");
      for (let seed = 5; seed <= 10; seed += 1) {
        assert.equal((await issue(seed)).allowed, true);
        await db.exec("reset role");
        await db.query(
          "delete from public.siwe_nonces where client_hash = $1",
          [clientHash]
        );
        await db.exec("set role service_role");
      }
      const rateLimited = await issue(11);
      assert.equal(rateLimited.allowed, false);
      assert.equal(rateLimited.reason, "rate_limited");
      assert.ok(rateLimited.retry_after_seconds >= 1);

      await db.exec("reset role");
      await db.exec(`
        truncate table public.siwe_nonces;
        insert into public.siwe_nonces (
          nonce_hash,
          client_hash,
          expires_at
        )
        select
          md5('nonce-' || value::text) || md5('nonce-x-' || value::text),
          md5('client-' || value::text) || md5('client-x-' || value::text),
          clock_timestamp() + interval '5 minutes'
        from generate_series(1, 10000) as value;
      `);
      await db.exec("set role service_role");

      const globalLimited = await issue(12000, "c".repeat(64));
      assert.equal(globalLimited.allowed, false);
      assert.equal(globalLimited.reason, "global_capacity");
      assert.ok(globalLimited.retry_after_seconds >= 1);
    } finally {
      await db.close();
    }
  }
);
