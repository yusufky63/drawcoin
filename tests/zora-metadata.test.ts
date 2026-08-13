import assert from "node:assert/strict";
import test from "node:test";

import { buildZoraCoinMetadata } from "../src/lib/zora/metadata.ts";

test("builds SDK-valid metadata with an IPFS image", () => {
  assert.deepEqual(
    buildZoraCoinMetadata({
      name: "  Canvas Cat  ",
      symbol: "  CAT  ",
      description: "  Drawn in DrawCoin.  ",
      image: "  ipfs://bafy-image  ",
    }),
    {
      name: "Canvas Cat",
      symbol: "CAT",
      description: "Drawn in DrawCoin.",
      image: "ipfs://bafy-image",
    }
  );
});

test("uses a deterministic description when the optional text is blank", () => {
  const metadata = buildZoraCoinMetadata({
    name: "Blue Bird",
    symbol: "BIRD",
    description: "   ",
    image: "ipfs://bafy-image",
  });

  assert.equal(
    metadata.description,
    "Blue Bird (BIRD) - A token created with DrawCoin"
  );
});

test("rejects metadata that would make the SDK validation skip unsafe", () => {
  assert.throws(
    () =>
      buildZoraCoinMetadata({
        name: "Canvas Cat",
        symbol: "CAT",
        image: "https://example.com/image.png",
      }),
    /IPFS URI/
  );
  assert.throws(
    () =>
      buildZoraCoinMetadata({
        name: "   ",
        symbol: "CAT",
        image: "ipfs://bafy-image",
      }),
    /name is required/
  );
});
