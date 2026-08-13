import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import {
  decodeDataImageUrl,
  IpfsInputError,
  MAX_IPFS_IMAGE_BYTES,
  readStreamWithLimit,
} from "../src/lib/ipfs/security.ts";

test("data image validation checks the declared type and magic bytes", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const result = decodeDataImageUrl(
    `data:image/png;base64,${png.toString("base64")}`
  );

  assert.equal(result.mimeType, "image/png");
  assert.deepEqual(Buffer.from(result.bytes), png);

  assert.throws(
    () =>
      decodeDataImageUrl(
        `data:image/png;base64,${Buffer.from("<html>not an image</html>").toString("base64")}`
      ),
    (error) => error instanceof IpfsInputError && error.status === 415
  );
  assert.throws(
    () =>
      decodeDataImageUrl(
        `data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`
      ),
    (error) => error instanceof IpfsInputError && error.status === 415
  );
});

test("data image validation rejects non-canonical and oversized base64", () => {
  assert.throws(
    () => decodeDataImageUrl("data:image/png;base64,iVBORw0KGgo"),
    (error) => error instanceof IpfsInputError && error.status === 400
  );

  const oversized = Buffer.alloc(MAX_IPFS_IMAGE_BYTES + 1).toString("base64");
  assert.throws(
    () => decodeDataImageUrl(`data:image/png;base64,${oversized}`),
    (error) => error instanceof IpfsInputError && error.status === 413
  );
});

test("stream reads stop at the configured byte limit", async () => {
  const withinLimit = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(Uint8Array.from([1, 2]));
      controller.enqueue(Uint8Array.from([3]));
      controller.close();
    },
  });
  assert.deepEqual(
    await readStreamWithLimit(withinLimit, 3),
    Uint8Array.from([1, 2, 3])
  );

  const overLimit = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(Uint8Array.from([1, 2]));
      controller.enqueue(Uint8Array.from([3, 4]));
      controller.close();
    },
  });
  await assert.rejects(
    readStreamWithLimit(overLimit, 3),
    (error) => error instanceof IpfsInputError && error.status === 413
  );
});
