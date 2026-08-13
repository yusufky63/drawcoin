import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pgliteModuleUrl = process.env.PGLITE_MODULE_URL;
const clientKey = (value) => value.toString(16).padStart(64, "0");

test(
  "IPFS upload quotas are private, atomic, and globally bounded",
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
          "../supabase/migrations/20260811192844_secure_ipfs_quotas.sql",
          import.meta.url
        ),
        "utf8"
      );
      await db.exec(migration);

      const privileges = await db.query(`
        select
          has_function_privilege(
            'service_role',
            'public.reserve_ipfs_upload(text,integer)',
            'EXECUTE'
          ) as service_can_reserve,
          not has_function_privilege(
            'anon',
            'public.reserve_ipfs_upload(text,integer)',
            'EXECUTE'
          ) as anon_cannot_reserve,
          not has_schema_privilege(
            'anon',
            'drawcoin_private',
            'USAGE'
          ) as private_schema_hidden
      `);
      assert.deepEqual(privileges.rows[0], {
        service_can_reserve: true,
        anon_cannot_reserve: true,
        private_schema_hidden: true,
      });

      const reserve = async (key, bytes = 1) => {
        const result = await db.query(
          "select * from public.reserve_ipfs_upload($1, $2)",
          [key, bytes]
        );
        return result.rows[0];
      };

      const sameWallet = await Promise.all(
        Array.from({ length: 4 }, () => reserve(clientKey(1)))
      );
      assert.equal(sameWallet.filter((row) => row.allowed).length, 3);
      assert.equal(sameWallet.filter((row) => !row.allowed).length, 1);
      assert.ok(
        sameWallet.find((row) => !row.allowed).retry_after_seconds >= 1
      );

      await db.exec(
        "truncate table drawcoin_private.ipfs_upload_rate_limits"
      );
      const manyWallets = await Promise.all(
        Array.from({ length: 12 }, (_, index) => reserve(clientKey(index + 10)))
      );
      assert.equal(manyWallets.filter((row) => row.allowed).length, 10);
      assert.equal(manyWallets.filter((row) => !row.allowed).length, 2);

      const counters = await db.query(`
        select bucket_key, request_count, image_bytes, pin_count
        from drawcoin_private.ipfs_upload_rate_limits
        where bucket_key in (
          'ipfs-upload:global:10m',
          'ipfs-upload:global:daily'
        )
        order by bucket_key
      `);
      assert.deepEqual(
        counters.rows.map((row) => ({
          bucket_key: row.bucket_key,
          request_count: row.request_count,
          image_bytes: Number(row.image_bytes),
          pin_count: row.pin_count,
        })),
        [
          {
            bucket_key: "ipfs-upload:global:10m",
            request_count: 10,
            image_bytes: 10,
            pin_count: 20,
          },
          {
            bucket_key: "ipfs-upload:global:daily",
            request_count: 10,
            image_bytes: 10,
            pin_count: 20,
          },
        ]
      );

      await assert.rejects(
        reserve(clientKey(99), 4_194_305),
        /invalid IPFS upload reservation parameters/
      );
    } finally {
      await db.close();
    }
  }
);
