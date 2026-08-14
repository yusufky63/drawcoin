import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import {
  assertSuccessfulZoraTradeReceipt,
  assertZoraTradeWalletSupported,
  isZoraTradeWalletSupported,
  ZORA_TRADE_EOA_ONLY_MESSAGE,
} from "../src/lib/zoraTradeSafety.js";

const sdkPath = new URL("../src/services/sdk/getTradeCoin.js", import.meta.url);
const tradeUiPaths = [
  new URL(
    "../src/components/coin/details/CoinTradeCard.tsx",
    import.meta.url,
  ),
  new URL("../src/components/market/DetailsModal.tsx", import.meta.url),
];
const walletTradeUiPaths = [
  new URL("../src/components/coin/CoinDetailPage.tsx", import.meta.url),
  new URL("../src/components/market/DetailsModal.tsx", import.meta.url),
  new URL("../src/components/market/TradeModal.tsx", import.meta.url),
];
const allTradePaths = [
  sdkPath,
  new URL("../src/services/sdk/tradeUtils.js", import.meta.url),
  new URL("../src/components/coin/CoinDetailPage.tsx", import.meta.url),
  new URL(
    "../src/components/coin/details/CoinTradeCard.tsx",
    import.meta.url,
  ),
  new URL("../src/components/market/DetailsModal.tsx", import.meta.url),
  new URL("../src/components/market/TradeModal.tsx", import.meta.url),
];

const sdkSource = await readFile(sdkPath, "utf8");

function loadSlippageSafetyFromSource() {
  const safetyBlock = sdkSource.match(
    /export const MIN_TRADE_SLIPPAGE[\s\S]*?return slippage;\s*}/,
  )?.[0];

  assert.ok(safetyBlock, "trade slippage validator must remain testable");

  const context = {};
  vm.runInNewContext(
    `${safetyBlock.replaceAll("export ", "")}; globalThis.tradeSafety = { MIN_TRADE_SLIPPAGE, MAX_TRADE_SLIPPAGE, assertSafeTradeSlippage };`,
    context,
  );

  return context.tradeSafety;
}

test("SDK accepts only finite slippage values between 0.1% and 10%", () => {
  const {
    MIN_TRADE_SLIPPAGE,
    MAX_TRADE_SLIPPAGE,
    assertSafeTradeSlippage,
  } = loadSlippageSafetyFromSource();

  assert.equal(MIN_TRADE_SLIPPAGE, 0.001);
  assert.equal(MAX_TRADE_SLIPPAGE, 0.1);
  for (const value of [0.001, 0.01, 0.05, 0.1]) {
    assert.equal(assertSafeTradeSlippage(value), value);
  }

  for (const value of [
    0,
    -0.01,
    0.100001,
    0.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    "0.05",
    undefined,
  ]) {
    assert.throws(
      () => assertSafeTradeSlippage(value),
      (error) =>
        error?.name === "RangeError" &&
        error?.message === "Slippage must be between 0.1% and 10%.",
    );
  }
});

test("SDK validates slippage before starting retryable wallet or RPC work", () => {
  const guardIndex = sdkSource.indexOf(
    "const safeSlippage = assertSafeTradeSlippage(slippage);",
  );
  const retryIndex = sdkSource.indexOf(
    "await retryWithBackoff(",
    guardIndex,
  );

  assert.ok(guardIndex >= 0, "SDK entry guard is missing");
  assert.ok(retryIndex > guardIndex, "guard must run before retry/RPC work");
  assert.match(sdkSource, /slippage:\s*safeSlippage/);
});

test("SDK never retries the wallet write", () => {
  const retryIndex = sdkSource.indexOf("await retryWithBackoff(");
  const writeIndex = sdkSource.indexOf("await tradeCoin(");

  assert.ok(retryIndex >= 0, "preflight retry is missing");
  assert.ok(writeIndex > retryIndex, "wallet write must follow preflight");
  assert.doesNotMatch(
    sdkSource.slice(retryIndex, writeIndex),
    /tradeCoin\(/,
    "wallet write must stay outside the retry callback",
  );
  assert.equal(
    sdkSource.match(/await tradeCoin\(/g)?.length,
    1,
    "the SDK must have exactly one wallet write call",
  );
});

test("a mined trade is successful only when the receipt status is success", () => {
  const successReceipt = {
    status: "success",
    transactionHash: `0x${"1".repeat(64)}`,
  };
  assert.equal(assertSuccessfulZoraTradeReceipt(successReceipt), successReceipt);

  for (const receipt of [
    undefined,
    null,
    { status: "reverted", transactionHash: `0x${"2".repeat(64)}` },
    { transactionHash: `0x${"3".repeat(64)}` },
  ]) {
    assert.throws(
      () => assertSuccessfulZoraTradeReceipt(receipt),
      /Zora trade reverted on Base/,
    );
  }

  const receiptGuardIndex = sdkSource.indexOf(
    "const result = assertSuccessfulZoraTradeReceipt(",
  );
  const writeIndex = sdkSource.indexOf("await tradeCoin(", receiptGuardIndex);
  const analyticsIndex = sdkSource.indexOf(
    "// Record analytics for trade",
    writeIndex,
  );
  assert.ok(receiptGuardIndex >= 0, "receipt status guard is missing");
  assert.ok(writeIndex > receiptGuardIndex, "guard must wrap the wallet result");
  assert.ok(
    analyticsIndex > writeIndex,
    "analytics must run only after receipt validation",
  );
});

test("Zora trade wallet support is an explicit fail-closed EOA allow-list", () => {
  assert.equal(isZoraTradeWalletSupported("injected"), true);
  for (const connectorId of ["baseAccount", "coinbaseSmartWallet", "", null]) {
    assert.equal(isZoraTradeWalletSupported(connectorId), false);
    assert.throws(
      () => assertZoraTradeWalletSupported(connectorId),
      (error) => error?.message === ZORA_TRADE_EOA_ONLY_MESSAGE,
    );
  }

  const walletGuardIndex = sdkSource.indexOf(
    "assertZoraTradeWalletSupported(walletConnectorId);",
  );
  const retryIndex = sdkSource.indexOf("await retryWithBackoff(", walletGuardIndex);
  assert.ok(walletGuardIndex >= 0, "wallet compatibility guard is missing");
  assert.ok(retryIndex > walletGuardIndex, "wallet guard must run before RPC work");

  const executeTradeIndex = sdkSource.indexOf(
    "export async function executeTrade({",
  );
  const wrapperGuardIndex = sdkSource.indexOf(
    "assertZoraTradeWalletSupported(walletConnectorId);",
    executeTradeIndex,
  );
  const decimalsReadIndex = sdkSource.indexOf(
    "await getTokenDecimals(",
    executeTradeIndex,
  );
  assert.ok(
    wrapperGuardIndex > executeTradeIndex && decimalsReadIndex > wrapperGuardIndex,
    "the simplified sell wrapper must reject unsupported wallets before RPC work",
  );
});

test("every trade entry UI passes its connector through the EOA guard", async () => {
  const sources = await Promise.all(
    walletTradeUiPaths.map((path) => readFile(path, "utf8")),
  );

  for (const source of sources) {
    assert.match(
      source,
      /isZoraTradeWalletSupported\(connector\?\.id\)/,
      "trade UI must derive compatibility from the active connector",
    );
    assert.match(
      source,
      /walletConnectorId:\s*connector\?\.id\s*\?\?\s*""/,
      "trade UI must pass an unknown connector through as unsupported",
    );
    assert.match(source, /ZORA_TRADE_EOA_ONLY_MESSAGE/);
  }
});

test("trade paths use real balances and contain no fabricated 10M creator lock", async () => {
  const sources = await Promise.all(
    allTradePaths.map((path) => readFile(path, "utf8")),
  );

  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /10_000_000|10000000|10M tokens|initial 10M|creator restriction/i,
    );
  }

  assert.match(
    sources[1],
    /if \(tokenBalance < amount\)/,
    "sell validation must compare against the actual onchain balance",
  );
});

test("the detail trade UI supports native USDC buys without unsafe amount rounding", async () => {
  const sources = await Promise.all(
    tradeUiPaths.map((path) => readFile(path, "utf8")),
  );

  assert.match(sources[0], /Buy with ETH or native USDC on Base\./);
  assert.match(sources[0], /\["ETH", "USDC"\]/);
  assert.match(sources[0], /amountForPercentage/);
  assert.doesNotMatch(sources[0], /0\.999|toFixed\(4\)/);

  for (const source of sources) {
    assert.doesNotMatch(source, /automatically retry/i);
    assert.match(source, /max="10"/);

    const options = source.match(/\{\[([^\]]+)\]\.map\(\(value\)/)?.[1];
    assert.ok(options, "quick slippage options are missing");
    const values = options.split(",").map((value) => Number(value.trim()));
    assert.ok(values.every((value) => value >= 0.001 && value <= 0.1));
  }
});

test("buy and sell parameters match the installed Zora trade contract", () => {
  const executeTradeStart = sdkSource.indexOf(
    "export async function executeTrade({",
  );
  const executeTradeEnd = sdkSource.indexOf(
    "export async function executeERC20Trade({",
    executeTradeStart,
  );
  const wrapper = sdkSource.slice(executeTradeStart, executeTradeEnd);

  assert.match(wrapper, /direction !== "buy" && direction !== "sell"/);
  assert.match(
    wrapper,
    /if \(direction === "buy"\)[\s\S]*?sellToken = \{ type: "eth" \};[\s\S]*?buyToken = \{ type: "erc20", address: coinAddress \};[\s\S]*?parseEther\(/,
  );
  assert.match(
    wrapper,
    /getTokenDecimals\(coinAddress, publicClient\)[\s\S]*?sellToken = \{ type: "erc20", address: coinAddress \};[\s\S]*?buyToken = \{ type: "eth" \};[\s\S]*?parseUnits\(/,
  );
  assert.doesNotMatch(
    sdkSource,
    /defaulting to 18/,
    "unknown token decimals must fail closed instead of changing the amount",
  );
  assert.match(
    sdkSource,
    /tradeCoin\(\{[\s\S]*?tradeParameters,[\s\S]*?walletClient,[\s\S]*?publicClient,[\s\S]*?validateTransaction/,
  );
  assert.match(
    sdkSource,
    /Trade output must be sent to the connected wallet\./,
    "recipient must stay bound to the connected wallet",
  );
  assert.match(
    sdkSource,
    /analyticsCoinAddress:\s*targetCoinAddress/,
    "ERC20-to-ERC20 buys must record the DrawCoin rather than USDC",
  );
});
