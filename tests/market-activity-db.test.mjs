import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260814162647_optimize_market_activity_and_creator_identity.sql",
    import.meta.url,
  ),
  "utf8",
);
const creatorCatalogMigration = await readFile(
  new URL(
    "../supabase/migrations/20260814164938_persist_creator_basenames_in_catalog.sql",
    import.meta.url,
  ),
  "utf8",
);

test("market activity migration keeps a server-only identity cache contract", () => {
  assert.match(migration, /last_trade_at timestamptz/i);
  assert.match(migration, /verified_trade_count integer not null default 0/i);
  assert.match(migration, /idx_drawcoins_last_trade_rank/i);
  assert.match(migration, /sync_drawcoin_trade_activity/i);
  assert.match(migration, /where verified_at is not null[\s\S]*?'buy'::public\.transaction_type[\s\S]*?'sell'::public\.transaction_type/i);
});

const pgliteModuleUrl = process.env.PGLITE_MODULE_URL;
test(
  "verified trades backfill and maintain one indexed coin activity summary",
  { skip: !pgliteModuleUrl },
  async () => {
    const { PGlite } = await import(pgliteModuleUrl);
    const db = new PGlite();
    try {
      await db.exec(`
        create role anon;
        create role authenticated;
        create role service_role;
        create type public.transaction_type as enum ('buy', 'sell', 'create');
        create table public.drawcoins (
          id uuid primary key,
          contract_address text not null unique,
          creator_address text not null,
          creator_name text,
          holders integer,
          created_at timestamptz not null default now()
        );
        create table public.transactions (
          id uuid primary key,
          token_address text,
          type public.transaction_type not null,
          "timestamp" timestamptz not null,
          verified_at timestamptz
        );
        insert into public.drawcoins (
          id, contract_address, creator_address, holders
        ) values (
          '00000000-0000-0000-0000-000000000001',
          '0xAaAa',
          '0x1111111111111111111111111111111111111111',
          3
        );
        insert into public.transactions (
          id, token_address, type, "timestamp", verified_at
        ) values
          ('00000000-0000-0000-0000-000000000011', '0xaaaa', 'buy', '2026-01-01', '2026-01-01'),
          ('00000000-0000-0000-0000-000000000012', '0xAAAA', 'sell', '2026-01-02', null);
      `);
      await db.exec(migration);

      let result = await db.query(`
        select last_trade_type, last_trade_at, verified_trade_count
        from public.drawcoins
      `);
      assert.equal(result.rows[0].last_trade_type, "buy");
      assert.equal(result.rows[0].verified_trade_count, 1);

      await db.exec(`
        update public.transactions
        set verified_at = '2026-01-02'
        where id = '00000000-0000-0000-0000-000000000012';
      `);
      result = await db.query(`
        select last_trade_type, verified_trade_count from public.drawcoins
      `);
      assert.deepEqual(result.rows[0], {
        last_trade_type: "sell",
        verified_trade_count: 2,
      });

      await db.exec(`
        delete from public.transactions
        where id = '00000000-0000-0000-0000-000000000012';
      `);
      result = await db.query(`
        select last_trade_type, verified_trade_count from public.drawcoins
      `);
      assert.deepEqual(result.rows[0], {
        last_trade_type: "buy",
        verified_trade_count: 1,
      });

      const privileges = await db.query(`
        select
          has_table_privilege('anon', 'public.creator_identity_cache', 'SELECT') as anon_read,
          has_table_privilege('authenticated', 'public.creator_identity_cache', 'SELECT') as auth_read,
          has_table_privilege('service_role', 'public.creator_identity_cache', 'SELECT') as service_read
      `);
      assert.deepEqual(privileges.rows[0], {
        anon_read: false,
        auth_read: false,
        service_read: true,
      });

      await db.exec(creatorCatalogMigration);
      await db.exec(`
        insert into public.creator_identity_cache (
          address, basename, source, expires_at
        ) values (
          '0x1111111111111111111111111111111111111111',
          'alice.base.eth',
          'base-l2',
          now() + interval '7 days'
        );
      `);
      result = await db.query(`
        select creator_name from public.drawcoins
      `);
      assert.equal(result.rows[0].creator_name, "alice.base.eth");

      await db.exec(`
        update public.creator_identity_cache
        set basename = 'studio.base.eth'
        where address = '0x1111111111111111111111111111111111111111';
      `);
      result = await db.query(`
        select creator_name from public.drawcoins
      `);
      assert.equal(result.rows[0].creator_name, "studio.base.eth");

      await db.exec(`
        update public.creator_identity_cache
        set basename = null, source = 'none'
        where address = '0x1111111111111111111111111111111111111111';
      `);
      result = await db.query(`
        select creator_name from public.drawcoins
      `);
      assert.equal(result.rows[0].creator_name, null);
    } finally {
      await db.close();
    }
  },
);
