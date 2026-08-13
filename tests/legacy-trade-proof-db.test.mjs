import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pgliteModuleUrl = process.env.PGLITE_MODULE_URL;

test(
  "legacy router proof commit is private, constrained, and idempotent",
  { skip: !pgliteModuleUrl },
  async () => {
    const { PGlite } = await import(pgliteModuleUrl);
    const db = new PGlite();
    const migration = await readFile(
      new URL(
        "../supabase/migrations/20260813165627_add_legacy_trade_proof_kind.sql",
        import.meta.url
      ),
      "utf8"
    );

    try {
      await db.exec(`
        create role anon nologin;
        create role authenticated nologin;
        create role service_role nologin bypassrls;

        create table public.transactions (
          id text primary key,
          tx_hash text not null,
          type text not null,
          verified_at timestamptz
        );

        create table public.activity_verifications (
          id bigint generated always as identity primary key,
          entity_type text not null,
          entity_id text not null,
          chain_id bigint not null,
          tx_hash text not null,
          block_number bigint not null,
          log_index integer not null,
          event_name text not null,
          verifier_version smallint not null default 1,
          verified_at timestamptz not null,
          constraint activity_verifications_entity_key unique (entity_type, entity_id),
          constraint activity_verifications_evidence_key unique (chain_id, tx_hash, log_index, event_name),
          constraint activity_verifications_verifier_version_check check (verifier_version = 1)
        );
        revoke all on public.transactions, public.activity_verifications from public, anon, authenticated;
        grant select, insert, update, delete on public.transactions, public.activity_verifications to service_role;
        grant usage, select on sequence public.activity_verifications_id_seq to service_role;
      `);
      await db.exec(migration);

      const hash = `0x${"a".repeat(64)}`;
      await db.query(
        "insert into public.transactions (id, tx_hash, type) values ($1, $2, 'buy')",
        ["tx-1", hash]
      );
      const first = await db.query(
        `select public.commit_legacy_trade_verification(
          $1, 8453, $2, 123, 7, 'CoinBuy',
          'universal_router_transfer', now()
        ) as committed`,
        ["tx-1", hash]
      );
      assert.equal(first.rows[0].committed, true);

      const proof = await db.query(
        "select proof_kind, verifier_version from public.activity_verifications where entity_id = 'tx-1'"
      );
      assert.deepEqual(proof.rows[0], {
        proof_kind: "universal_router_transfer",
        verifier_version: 2,
      });

      const second = await db.query(
        `select public.commit_legacy_trade_verification(
          $1, 8453, $2, 123, 7, 'CoinBuy',
          'universal_router_transfer', now()
        ) as committed`,
        ["tx-1", hash]
      );
      assert.equal(second.rows[0].committed, false);

      const privileges = await db.query(`
        select
          has_function_privilege(
            'anon',
            'public.commit_legacy_trade_verification(text,bigint,text,bigint,integer,text,text,timestamptz)',
            'EXECUTE'
          ) as anon_execute,
          has_function_privilege(
            'service_role',
            'public.commit_legacy_trade_verification(text,bigint,text,bigint,integer,text,text,timestamptz)',
            'EXECUTE'
          ) as service_execute
      `);
      assert.deepEqual(privileges.rows[0], {
        anon_execute: false,
        service_execute: true,
      });
    } finally {
      await db.close();
    }
  }
);
