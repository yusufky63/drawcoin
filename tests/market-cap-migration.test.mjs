import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260813185953_add_market_cap_sort_key.sql",
    import.meta.url,
  ),
  "utf8",
);
const pgliteModuleUrl = process.env.PGLITE_MODULE_URL;

test("market cap migration defines a native numeric generated column and index", () => {
  assert.match(
    migration,
    /when current_price > 0 and total_supply > 0\s+then current_price \* total_supply/,
  );
  assert.match(migration, /numeric generated always as/);
  assert.match(
    migration,
    /\(market_cap desc nulls last, created_at desc, id desc\)/,
  );
  assert.doesNotMatch(migration, /btrim|::text|::numeric/);
});

test("market cap migration derives sortable values and preserves missing metrics", { skip: !pgliteModuleUrl }, async () => {
  const { PGlite } = await import(pgliteModuleUrl);
  const db = new PGlite();
  try {
    await db.exec(`
      create schema if not exists public;
      create table public.drawcoins (
        id bigint primary key,
        current_price numeric,
        total_supply numeric,
        created_at timestamptz
      );
      ${migration}
    `);
    await db.query(`
      insert into public.drawcoins (id, current_price, total_supply, created_at)
      values
        (1, '2.5', '1000', '2026-08-13T10:00:00Z'),
        (2, null, '1000', '2026-08-13T11:00:00Z'),
        (3, '3e-1', '10000', '2026-08-13T09:00:00Z')
    `);

    const { rows } = await db.query(
      "select id, market_cap::text as market_cap from public.drawcoins order by market_cap desc nulls last, created_at desc, id desc",
    );
    assert.deepEqual(rows, [
      { id: 3, market_cap: "3000.0" },
      { id: 1, market_cap: "2500.0" },
      { id: 2, market_cap: null },
    ]);
  } finally {
    await db.close();
  }
});
