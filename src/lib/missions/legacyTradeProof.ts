import { coinV4ABI, universalRouterAddress } from "@zoralabs/protocol-deployments";
import {
  erc20Abi,
  isAddressEqual,
  parseEventLogs,
  zeroAddress,
  type Address,
  type TransactionReceipt,
} from "viem";
import {
  entryPoint06Abi,
  entryPoint06Address,
} from "viem/account-abstraction";
import { base } from "viem/chains";

export type LegacyTradeType = "buy" | "sell";

export type LegacyTradeProof = {
  eventName: "CoinBuy" | "CoinSell";
  logIndex: number;
  proofKind:
    | "direct_coin_event"
    | "universal_router_transfer"
    | "entrypoint_transfer";
  verifierVersion: 1 | 2;
};

type TransactionIdentity = {
  from: Address;
  to: Address | null;
};

function findDirectCoinEvent(input: {
  receipt: TransactionReceipt;
  token: Address;
  user: Address;
  type: LegacyTradeType;
}): LegacyTradeProof | null {
  const expectedEventName = input.type === "buy" ? "CoinBuy" : "CoinSell";
  const decodedLogs = parseEventLogs({
    abi: coinV4ABI,
    logs: input.receipt.logs.filter((log) =>
      isAddressEqual(log.address, input.token)
    ),
    strict: true,
  });

  const matchingEvent = decodedLogs.find((event) => {
    if (event.eventName !== expectedEventName) return false;
    if (event.eventName === "CoinBuy") {
      return isAddressEqual(event.args.recipient, input.user);
    }
    if (event.eventName === "CoinSell") {
      return isAddressEqual(event.args.seller, input.user);
    }
    return false;
  });

  if (!matchingEvent) return null;
  return {
    eventName: expectedEventName,
    logIndex: matchingEvent.logIndex,
    proofKind: "direct_coin_event",
    verifierVersion: 1,
  };
}

function hasSuccessfulUserOperation(
  receipt: TransactionReceipt,
  user: Address
): boolean {
  const events = parseEventLogs({
    abi: entryPoint06Abi,
    eventName: "UserOperationEvent",
    logs: receipt.logs.filter((log) =>
      isAddressEqual(log.address, entryPoint06Address)
    ),
    strict: true,
  });

  return events.some(
    (event) =>
      isAddressEqual(event.args.sender, user) && event.args.success === true
  );
}

function findTransferLog(input: {
  receipt: TransactionReceipt;
  token: Address;
  user: Address;
  type: LegacyTradeType;
}) {
  const transfers = parseEventLogs({
    abi: erc20Abi,
    eventName: "Transfer",
    logs: input.receipt.logs.filter((log) =>
      isAddressEqual(log.address, input.token)
    ),
    strict: true,
  });

  return transfers.find((event) => {
    if (event.args.value <= BigInt(0)) return false;
    if (input.type === "buy") {
      return (
        isAddressEqual(event.args.to, input.user) &&
        !isAddressEqual(event.args.from, zeroAddress) &&
        !isAddressEqual(event.args.from, input.user)
      );
    }
    return (
      isAddressEqual(event.args.from, input.user) &&
      !isAddressEqual(event.args.to, zeroAddress) &&
      !isAddressEqual(event.args.to, input.user)
    );
  });
}

export function findLegacyTradeProof(input: {
  receipt: TransactionReceipt;
  transaction: TransactionIdentity | null;
  token: Address;
  user: Address;
  type: LegacyTradeType;
}): LegacyTradeProof | null {
  const directProof = findDirectCoinEvent(input);
  if (directProof) return directProof;
  if (!input.transaction?.to) return null;

  const transfer = findTransferLog(input);
  if (!transfer) return null;

  const universalRouter = universalRouterAddress[base.id];
  if (
    isAddressEqual(input.transaction.to, universalRouter) &&
    isAddressEqual(input.transaction.from, input.user)
  ) {
    return {
      eventName: input.type === "buy" ? "CoinBuy" : "CoinSell",
      logIndex: transfer.logIndex,
      proofKind: "universal_router_transfer",
      verifierVersion: 2,
    };
  }

  if (
    isAddressEqual(input.transaction.to, entryPoint06Address) &&
    hasSuccessfulUserOperation(input.receipt, input.user)
  ) {
    return {
      eventName: input.type === "buy" ? "CoinBuy" : "CoinSell",
      logIndex: transfer.logIndex,
      proofKind: "entrypoint_transfer",
      verifierVersion: 2,
    };
  }

  return null;
}
