import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { getCoinsBatchSDK } from "../src/services/sdk/getCoins.js";
import { getCoinsBatchWithRetry } from "../src/services/zoraService.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function addressFor(index) {
  return `0x${index.toString(16).padStart(40, "0")}`;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function coinQueries(request) {
  return new URL(request.url).searchParams
    .getAll("coins")
    .map((coin) => JSON.parse(coin));
}

function coinFor(address) {
  return { address, name: `Coin ${address.slice(-4)}`, symbol: "TEST" };
}

test("batch queries cover every address in stable 20-item chunks", async () => {
  const addresses = Array.from({ length: 22 }, (_, index) =>
    addressFor(index + 1)
  );
  const addressesWithDuplicate = [
    ...addresses.slice(0, 9),
    addresses[2].toUpperCase(),
    ...addresses.slice(9),
  ];
  const chunks = [];

  globalThis.fetch = async (request) => {
    const coins = coinQueries(request);
    chunks.push(coins.map((coin) => coin.collectionAddress));
    return jsonResponse({
      zora20Tokens: coins.map((coin) => coinFor(coin.collectionAddress)),
    });
  };

  const result = await getCoinsBatchSDK(addressesWithDuplicate, 8453, {
    fallbackToIndividual: false,
  });

  assert.deepEqual(
    chunks.map((chunk) => chunk.length),
    [20, 2]
  );
  assert.deepEqual(chunks.flat(), addresses);
  assert.equal(Object.keys(result).length, addresses.length);
  for (const address of addresses) {
    assert.equal(result[address]?.address, address);
  }
});

test("a failed chunk falls back individually without discarding other chunks", async (t) => {
  t.mock.method(console, "error", () => {});
  const addresses = Array.from({ length: 41 }, (_, index) =>
    addressFor(index + 1)
  );
  let batchCalls = 0;
  let individualCalls = 0;

  globalThis.fetch = async (request) => {
    const url = new URL(request.url);
    if (url.pathname === "/coins") {
      batchCalls += 1;
      const coins = coinQueries(request);
      if (batchCalls === 2) {
        return jsonResponse({ message: "temporary upstream failure" }, 503);
      }
      return jsonResponse({
        zora20Tokens: coins.map((coin) => coinFor(coin.collectionAddress)),
      });
    }

    if (url.pathname === "/coin") {
      individualCalls += 1;
      const address = url.searchParams.get("address");
      return jsonResponse({ zora20Token: coinFor(address) });
    }

    throw new Error(`Unexpected Zora test URL: ${url.pathname}`);
  };

  const result = await getCoinsBatchSDK(addresses);

  assert.equal(batchCalls, 3);
  assert.equal(individualCalls, 20);
  assert.equal(Object.keys(result).length, addresses.length);
  for (const address of addresses) {
    assert.equal(result[address]?.address, address);
  }
});

test("resolved SDK error envelopes trigger the bounded retry policy", async (t) => {
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "warn", () => {});
  const addresses = [addressFor(1), addressFor(2)];
  let batchCalls = 0;
  let individualCalls = 0;

  globalThis.fetch = async (request) => {
    const url = new URL(request.url);
    if (url.pathname === "/coin") {
      individualCalls += 1;
      return jsonResponse({ message: "temporary upstream failure" }, 503);
    }

    batchCalls += 1;
    if (batchCalls === 1) {
      return jsonResponse({ message: "temporary upstream failure" }, 503);
    }

    const coins = coinQueries(request);
    return jsonResponse({
      zora20Tokens: coins.map((coin) => coinFor(coin.collectionAddress)),
    });
  };

  const result = await getCoinsBatchWithRetry(addresses, 8453, {
    initialBackoffMs: 0,
    maxRetries: 2,
  });

  assert.equal(batchCalls, 2);
  assert.equal(individualCalls, addresses.length);
  assert.equal(result[addresses[0]]?.address, addresses[0]);
  assert.equal(result[addresses[1]]?.address, addresses[1]);
});

test("an aborted batch never starts the individual fallback", async () => {
  const controller = new AbortController();
  let individualCalls = 0;

  globalThis.fetch = async (request) => {
    const url = new URL(request.url);
    if (url.pathname === "/coin") individualCalls += 1;

    return await new Promise((resolve, reject) => {
      const onAbort = () => reject(request.signal.reason);
      if (request.signal.aborted) onAbort();
      else request.signal.addEventListener("abort", onAbort, { once: true });
    });
  };

  const request = getCoinsBatchSDK([addressFor(1)], 8453, {
    signal: controller.signal,
  });
  controller.abort();

  await assert.rejects(request, (error) => error?.name === "AbortError");
  assert.equal(individualCalls, 0);
});
