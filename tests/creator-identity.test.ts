import assert from "node:assert/strict";
import test from "node:test";

import {
  createCreatorAddressBatch,
  formatCreatorAddress,
  getCreatorDisplayLabel,
  normalizeBasename,
  normalizeCreatorAddress,
} from "../src/lib/creatorIdentity.ts";

const CREATOR = "0x000000000000000000000000000000000000dead";

test("creator addresses are normalized and shortened deterministically", () => {
  assert.equal(normalizeCreatorAddress(CREATOR.toUpperCase().replace("0X", "0x")), CREATOR);
  assert.equal(formatCreatorAddress(CREATOR), "0x0000…dEaD");
});

test("a resolved Basename wins over persisted legacy data", () => {
  assert.equal(
    getCreatorDisplayLabel({
      address: CREATOR,
      persistedName: CREATOR,
      resolvedBasename: " Alice.Base.ETH ",
    }),
    "alice.base.eth"
  );
});

test("only Basename-shaped persisted names are rendered on cards", () => {
  assert.equal(normalizeBasename("alice"), null);
  assert.equal(
    getCreatorDisplayLabel({ address: CREATOR, persistedName: CREATOR }),
    "0x0000…dEaD"
  );
  assert.equal(
    getCreatorDisplayLabel({
      address: CREATOR,
      persistedName: "artist.base.eth",
    }),
    "artist.base.eth"
  );
});

test("invalid or missing creator addresses do not produce misleading labels", () => {
  assert.equal(formatCreatorAddress("not-an-address"), null);
  assert.equal(getCreatorDisplayLabel({ address: null }), null);
});

test("visible creator addresses form one normalized bounded batch", () => {
  const second = "0x000000000000000000000000000000000000beef";
  assert.deepEqual(
    createCreatorAddressBatch(
      [CREATOR, CREATOR.toUpperCase().replace("0X", "0x"), second],
      2
    ),
    [CREATOR, second]
  );
  assert.deepEqual(createCreatorAddressBatch([CREATOR, second], 1), [CREATOR]);
});
