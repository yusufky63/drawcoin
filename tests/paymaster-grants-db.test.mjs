import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pgliteModuleUrl = process.env.PGLITE_MODULE_URL;

test(
  "paymaster grants are private and atomically bounded",
  { skip: !pgliteModuleUrl },
  async () => {
    const { PGlite } = await import(pgliteModuleUrl);
    const db = new PGlite();

    try {
      await db.exec(`
        create role anon nologin;
        create role authenticated nologin;
        create role service_role nologin bypassrls;
      `);
      const migration = await readFile(
        new URL(
          "../supabase/migrations/20260811173355_secure_paymaster_grants.sql",
          import.meta.url
        ),
        "utf8"
      );
      await db.exec(migration);

      const security = await db.query(`
        select
          has_table_privilege('anon', 'public.paymaster_grants', 'SELECT')
            as anon_read,
          has_table_privilege(
            'service_role',
            'public.paymaster_grants',
            'SELECT,INSERT,UPDATE,DELETE'
          ) as service_access,
          has_function_privilege(
            'anon',
            'public.issue_paymaster_grant(uuid,text,text,bigint,numeric,numeric,text,timestamp with time zone)',
            'EXECUTE'
          ) as anon_issue,
          has_function_privilege(
            'service_role',
            'public.reserve_paymaster_grant(uuid,text,text,bigint,numeric,numeric,text,timestamp with time zone,text)',
            'EXECUTE'
          ) as service_reserve,
          c.relrowsecurity as rls_enabled,
          every(not p.prosecdef) as invoker_only
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        cross join pg_catalog.pg_proc p
        join pg_catalog.pg_namespace pn on pn.oid = p.pronamespace
        where n.nspname = 'public'
          and c.relname = 'paymaster_grants'
          and pn.nspname = 'public'
          and p.proname in (
            'issue_paymaster_grant',
            'reserve_paymaster_grant'
          )
        group by c.relrowsecurity;
      `);
      const securityRow = security.rows[0];
      assert.equal(securityRow.anon_read, false);
      assert.equal(securityRow.service_access, true);
      assert.equal(securityRow.anon_issue, false);
      assert.equal(securityRow.service_reserve, true);
      assert.equal(securityRow.rls_enabled, true);
      assert.equal(securityRow.invoker_only, true);

      await db.exec("set role service_role");
      const grant = {
        id: "11111111-1111-4111-8111-111111111111",
        account: `0x${"11".repeat(20)}`,
        contract: `0x${"22".repeat(20)}`,
        chain: 84532,
        token: "1",
        nonce: "7",
        hash: `0x${"aa".repeat(32)}`,
      };

      const issue = (id = grant.id) =>
        db.query(
          `select public.issue_paymaster_grant(
            $1, $2, $3, $4, $5, $6, $7,
            statement_timestamp() + interval '5 minutes'
          ) as allowed`,
          [
            id,
            grant.account,
            grant.contract,
            grant.chain,
            grant.token,
            grant.nonce,
            grant.hash,
          ]
        );

      assert.equal((await issue()).rows[0].allowed, true);
      assert.equal(
        (
          await issue("22222222-2222-4222-8222-222222222222")
        ).rows[0].allowed,
        false
      );

      const reserve = (method) =>
        db.query(
          `select public.reserve_paymaster_grant(
            $1, $2, $3, $4, $5, $6, $7,
            (select expires_at from public.paymaster_grants where grant_id = $1),
            $8
          ) as allowed`,
          [
            grant.id,
            grant.account,
            grant.contract,
            grant.chain,
            grant.token,
            grant.nonce,
            grant.hash,
            method,
          ]
        );

      for (let attempt = 0; attempt < 8; attempt += 1) {
        assert.equal(
          (await reserve("pm_getPaymasterStubData")).rows[0].allowed,
          true
        );
      }
      assert.equal(
        (await reserve("pm_getPaymasterStubData")).rows[0].allowed,
        false
      );
      assert.equal(
        (await reserve("pm_getPaymasterData")).rows[0].allowed,
        true
      );
      assert.equal(
        (await reserve("pm_getPaymasterData")).rows[0].allowed,
        false
      );
      assert.equal(
        (await reserve("pm_getPaymasterStubData")).rows[0].allowed,
        false
      );
    } finally {
      await db.close();
    }
  }
);
