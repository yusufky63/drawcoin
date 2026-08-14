import assert from "node:assert/strict";
import test from "node:test";

import {
  getWalletActionErrorMessage,
  isUserRejectedWalletAction,
} from "../src/lib/walletActionError.ts";

test("wallet rejection errors never expose viem request arguments", () => {
  const error = Object.assign(
    new Error(
      "User rejected the request. Request Arguments: chain: undefined (id: 8453) from: 0xabc to: 0xdef Version: viem@2.55.13"
    ),
    { code: 4001 }
  );

  assert.equal(isUserRejectedWalletAction(error), true);
  assert.equal(
    getWalletActionErrorMessage(error, {
      rejected: "Badge claim cancelled.",
      fallback: "Badge claim failed.",
    }),
    "Badge claim cancelled."
  );
});

test("nested wallet causes are sanitized into short actionable messages", () => {
  const error = {
    message: "ContractFunctionExecutionError",
    cause: { details: "insufficient funds for gas * price + value" },
  };

  assert.equal(
    getWalletActionErrorMessage(error, {
      rejected: "Transaction cancelled.",
      fallback: "Transaction failed.",
    }),
    "Insufficient balance for this transaction."
  );
});
