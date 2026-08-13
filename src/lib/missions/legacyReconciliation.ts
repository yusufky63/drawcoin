import "server-only";

import { getCoinCreateFromLogs } from "@zoralabs/coins-sdk";
import { coinFactoryAddress } from "@zoralabs/protocol-deployments";
import {
  getAddress,
  isAddress,
  isAddressEqual,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { base } from "viem/chains";

import { basePublicClient } from "@/lib/basePublicClient";
import { DRAWCOIN_PLATFORM_REFERRER } from "@/lib/drawcoinPlatform";
import { mapWithConcurrency } from "@/lib/market/requestPolicy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { findLegacyTradeProof } from "./legacyTradeProof";
import { evaluateMissions } from "./service";

const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const MAX_LIMIT = 50;

export type LegacyReconciliationScope = "drawcoins" | "transactions" | "all";

type LegacyDrawcoinRow = {
  id: string | number;
  contract_address: string;
  creator_address: string;
  tx_hash: string;
  chain_id: number | null;
  platform_referrer: string | null;
};

type LegacyTransactionRow = {
  id: string | number;
  tx_hash: string;
  user_address: string | null;
  token_address: string | null;
  type: string;
};

export type ReconciliationItem = {
  entityType: "drawcoin" | "transaction";
  entityId: string;
  txHash: string | null;
  address: string | null;
  outcome: "eligible" | "verified" | "already_verified" | "rejected" | "unavailable";
  reason: string;
};

export type ReconciliationReport = {
  mode: "dry-run" | "apply";
  scope: LegacyReconciliationScope;
  requestedLimit: number;
  requestedOffset: number;
  scanned: number;
  eligible: number;
  verified: number;
  rejected: number;
  unavailable: number;
  affectedAddresses: `0x${string}`[];
  missionEvaluations: {
    requested: number;
    completed: number;
    failed: number;
  };
  items: ReconciliationItem[];
};

type CanonicalEvidence = {
  entityType: "drawcoin" | "transaction";
  entityId: string;
  txHash: Hex;
  address: `0x${string}`;
  blockNumber: bigint;
  logIndex: number;
  eventName: "CoinCreatedV4" | "CoinBuy" | "CoinSell";
  proofKind: "direct_coin_event" | "universal_router_transfer" | "entrypoint_transfer";
  verifierVersion: 1 | 2;
  verifiedAt: string;
};

function normalizeLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1) return 10;
  return Math.min(value, MAX_LIMIT);
}

function normalizedAddress(value: string | null): Address | null {
  if (!value || !isAddress(value, { strict: false })) return null;
  return getAddress(value);
}

function isReceiptUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  return /not found|timeout|timed out|network|fetch|rpc|request/i.test(
    error.message
  );
}

function receiptTime(receipt: TransactionReceipt): Promise<string> {
  return basePublicClient
    .getBlock({ blockNumber: receipt.blockNumber })
    .then((block) => new Date(Number(block.timestamp) * 1_000).toISOString());
}

async function verifyLegacyDrawcoin(
  row: LegacyDrawcoinRow
): Promise<CanonicalEvidence | ReconciliationItem> {
  const entityId = String(row.id);
  const creator = normalizedAddress(row.creator_address);
  const coin = normalizedAddress(row.contract_address);
  if (
    row.chain_id !== base.id ||
    !creator ||
    !coin ||
    !TX_HASH_PATTERN.test(row.tx_hash)
  ) {
    return {
      entityType: "drawcoin",
      entityId,
      txHash: TX_HASH_PATTERN.test(row.tx_hash) ? row.tx_hash.toLowerCase() : null,
      address: creator?.toLowerCase() ?? null,
      outcome: "rejected",
      reason: "Stored Base creation identity is incomplete or invalid.",
    };
  }

  try {
    const txHash = row.tx_hash.toLowerCase() as Hex;
    const receipt = await basePublicClient.getTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      return {
        entityType: "drawcoin",
        entityId,
        txHash,
        address: creator.toLowerCase(),
        outcome: "rejected",
        reason: "Base receipt was not successful.",
      };
    }

    const officialFactory = coinFactoryAddress[base.id];
    const factoryLogs = receipt.logs.filter((log) =>
      isAddressEqual(log.address, officialFactory)
    );
    let deployment: NonNullable<
      ReturnType<typeof getCoinCreateFromLogs>
    > | null = null;
    let matchingLog: (typeof factoryLogs)[number] | null = null;
    for (const log of factoryLogs) {
      try {
        const decoded = getCoinCreateFromLogs({ ...receipt, logs: [log] });
        if (decoded && isAddressEqual(getAddress(decoded.coin), coin)) {
          deployment = decoded;
          matchingLog = log;
          break;
        }
      } catch {
        // Ignore malformed look-alike logs and continue scanning the receipt.
      }
    }
    const storedReferrer = normalizedAddress(row.platform_referrer);
    if (
      !deployment ||
      !matchingLog ||
      !isAddressEqual(getAddress(deployment.coin), coin) ||
      !isAddressEqual(getAddress(deployment.caller), creator) ||
      !isAddressEqual(
        getAddress(deployment.platformReferrer),
        DRAWCOIN_PLATFORM_REFERRER
      ) ||
      (storedReferrer &&
        !isAddressEqual(storedReferrer, getAddress(deployment.platformReferrer)))
    ) {
      return {
        entityType: "drawcoin",
        entityId,
        txHash,
        address: creator.toLowerCase(),
        outcome: "rejected",
        reason: "Official CoinCreatedV4 identity does not match the stored row.",
      };
    }

    const code = await basePublicClient.getCode({ address: coin });
    if (!code || code === "0x") {
      return {
        entityType: "drawcoin",
        entityId,
        txHash,
        address: creator.toLowerCase(),
        outcome: "rejected",
        reason: "Created coin contract is not deployed on Base.",
      };
    }

    return {
      entityType: "drawcoin",
      entityId,
      txHash,
      address: creator.toLowerCase() as `0x${string}`,
      blockNumber: receipt.blockNumber,
      logIndex: matchingLog.logIndex,
      eventName: "CoinCreatedV4",
      proofKind: "direct_coin_event",
      verifierVersion: 1,
      verifiedAt: await receiptTime(receipt),
    };
  } catch (error) {
    return {
      entityType: "drawcoin",
      entityId,
      txHash: row.tx_hash.toLowerCase(),
      address: creator.toLowerCase(),
      outcome: isReceiptUnavailable(error) ? "unavailable" : "rejected",
      reason: isReceiptUnavailable(error)
        ? "Base receipt is temporarily unavailable."
        : "Base receipt could not be decoded safely.",
    };
  }
}

async function verifyLegacyTransaction(
  row: LegacyTransactionRow
): Promise<CanonicalEvidence | ReconciliationItem> {
  const entityId = String(row.id);
  const user = normalizedAddress(row.user_address);
  const token = normalizedAddress(row.token_address);
  const type = row.type === "buy" || row.type === "sell" ? row.type : null;
  if (!user || !token || !type || !TX_HASH_PATTERN.test(row.tx_hash)) {
    return {
      entityType: "transaction",
      entityId,
      txHash: TX_HASH_PATTERN.test(row.tx_hash) ? row.tx_hash.toLowerCase() : null,
      address: user?.toLowerCase() ?? null,
      outcome: "rejected",
      reason: "Stored trade identity is incomplete or unsupported.",
    };
  }

  try {
    const txHash = row.tx_hash.toLowerCase() as Hex;
    const { data: verifiedCoin, error: coinError } = await supabaseAdmin
      .from("drawcoins")
      .select("contract_address")
      .ilike("contract_address", token)
      .not("verified_at", "is", null)
      .maybeSingle();
    if (coinError) throw coinError;
    if (!verifiedCoin) {
      return {
        entityType: "transaction",
        entityId,
        txHash,
        address: user.toLowerCase(),
        outcome: "rejected",
        reason:
          "Stored coin is not verified yet; reconcile its creation before this trade.",
      };
    }

    const receipt = await basePublicClient.getTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      return {
        entityType: "transaction",
        entityId,
        txHash,
        address: user.toLowerCase(),
        outcome: "rejected",
        reason: "Base receipt was not successful.",
      };
    }

    const transaction = await basePublicClient.getTransaction({ hash: txHash });
    const proof = findLegacyTradeProof({
      receipt,
      transaction,
      token,
      user,
      type,
    });
    if (!proof) {
      return {
        entityType: "transaction",
        entityId,
        txHash,
        address: user.toLowerCase(),
        outcome: "rejected",
        reason:
          "No verified coin event or approved router transfer matches the stored trade.",
      };
    }

    const rawLog = receipt.logs.find(
      (log) => log.logIndex === proof.logIndex
    );
    if (!rawLog || !isAddressEqual(rawLog.address, token)) {
      return {
        entityType: "transaction",
        entityId,
        txHash,
        address: user.toLowerCase(),
        outcome: "rejected",
        reason: "Matching trade log identity is invalid.",
      };
    }

    return {
      entityType: "transaction",
      entityId,
      txHash,
      address: user.toLowerCase() as `0x${string}`,
      blockNumber: receipt.blockNumber,
      logIndex: proof.logIndex,
      eventName: proof.eventName,
      proofKind: proof.proofKind,
      verifierVersion: proof.verifierVersion,
      verifiedAt: await receiptTime(receipt),
    };
  } catch (error) {
    return {
      entityType: "transaction",
      entityId,
      txHash: row.tx_hash.toLowerCase(),
      address: user.toLowerCase(),
      outcome: isReceiptUnavailable(error) ? "unavailable" : "rejected",
      reason: isReceiptUnavailable(error)
        ? "Base receipt is temporarily unavailable."
        : "Base trade receipt could not be decoded safely.",
    };
  }
}

async function commitEvidence(
  evidence: CanonicalEvidence
): Promise<ReconciliationItem> {
  const rpcResult =
    evidence.verifierVersion === 2
      ? await supabaseAdmin.rpc("commit_legacy_trade_verification", {
          p_entity_id: evidence.entityId,
          p_chain_id: base.id,
          p_tx_hash: evidence.txHash,
          p_block_number: evidence.blockNumber.toString(),
          p_log_index: evidence.logIndex,
          p_event_name: evidence.eventName,
          p_proof_kind: evidence.proofKind,
          p_verified_at: evidence.verifiedAt,
        })
      : await supabaseAdmin.rpc("commit_legacy_activity_verification", {
      p_entity_type: evidence.entityType,
      p_entity_id: evidence.entityId,
      p_chain_id: base.id,
      p_tx_hash: evidence.txHash,
      p_block_number: evidence.blockNumber.toString(),
      p_log_index: evidence.logIndex,
      p_event_name: evidence.eventName,
      p_verified_at: evidence.verifiedAt,
        });
  const { data, error } = rpcResult;
  if (error) throw error;

  return {
    entityType: evidence.entityType,
    entityId: evidence.entityId,
    txHash: evidence.txHash,
    address: evidence.address,
    outcome: data ? "verified" : "already_verified",
    reason: data
      ? "Canonical Base evidence was committed."
      : "Another run already verified or changed this row.",
  };
}

async function readLegacyRows(
  scope: LegacyReconciliationScope,
  limit: number,
  offset: number,
  address?: Address
) {
  const drawcoinLimit = scope === "transactions" ? 0 : limit;
  const transactionLimit = scope === "drawcoins" ? 0 : limit;

  let drawcoinQuery = supabaseAdmin
    .from("drawcoins")
    .select(
      "id, contract_address, creator_address, tx_hash, chain_id, platform_referrer"
    )
    .is("verified_at", null)
    .order("created_at", { ascending: true })
    .range(offset, offset + Math.max(0, drawcoinLimit - 1));
  let transactionQuery = supabaseAdmin
    .from("transactions")
    .select("id, tx_hash, user_address, token_address, type")
    .is("verified_at", null)
    .in("type", ["buy", "sell"])
    .order("timestamp", { ascending: true })
    .range(offset, offset + Math.max(0, transactionLimit - 1));

  if (address) {
    drawcoinQuery = drawcoinQuery.ilike("creator_address", address);
    transactionQuery = transactionQuery.ilike("user_address", address);
  }

  const [drawcoinsResult, transactionsResult] = await Promise.all([
    drawcoinLimit > 0 ? drawcoinQuery : Promise.resolve({ data: [], error: null }),
    transactionLimit > 0
      ? transactionQuery
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (drawcoinsResult.error) throw drawcoinsResult.error;
  if (transactionsResult.error) throw transactionsResult.error;

  return {
    drawcoins: (drawcoinsResult.data ?? []) as LegacyDrawcoinRow[],
    transactions: (transactionsResult.data ?? []) as LegacyTransactionRow[],
  };
}

export async function reconcileLegacyMissionActivity(input: {
  scope: LegacyReconciliationScope;
  limit: number;
  offset?: number;
  apply: boolean;
  address?: Address;
}): Promise<ReconciliationReport> {
  const limit = normalizeLimit(input.limit);
  const offset = Math.max(0, Math.min(10_000, input.offset ?? 0));
  const rows = await readLegacyRows(input.scope, limit, offset, input.address);
  const items: ReconciliationItem[] = [];
  const affected = new Set<`0x${string}`>();

  const processResults = async (
    results: Array<CanonicalEvidence | ReconciliationItem>
  ) => {
    for (const result of results) {
      if ("outcome" in result) {
        items.push(result);
        continue;
      }

      if (!input.apply) {
        items.push({
          entityType: result.entityType,
          entityId: result.entityId,
          txHash: result.txHash,
          address: result.address,
          outcome: "eligible",
          reason: "Canonical Base evidence matches; no database write was made.",
        });
        continue;
      }

      try {
        const committed = await commitEvidence(result);
        items.push(committed);
        if (committed.outcome === "verified") affected.add(result.address);
      } catch (error) {
        console.error("Failed to commit canonical legacy evidence", {
          entityType: result.entityType,
          entityId: result.entityId,
          error,
        });
        items.push({
          entityType: result.entityType,
          entityId: result.entityId,
          txHash: result.txHash,
          address: result.address,
          outcome: "unavailable",
          reason: "Canonical evidence matched, but the database commit failed.",
        });
      }
    }
  };

  // Creation proofs are committed first so a trade can only be promoted after
  // its stored coin is already known to be an official Zora/DrawCoin deploy.
  const drawcoinResults = await mapWithConcurrency(
    rows.drawcoins,
    3,
    verifyLegacyDrawcoin
  );
  await processResults(drawcoinResults);
  const transactionResults = await mapWithConcurrency(
    rows.transactions,
    3,
    verifyLegacyTransaction
  );
  await processResults(transactionResults);

  const affectedAddresses = [...affected];
  const evaluationResults = input.apply
    ? await mapWithConcurrency(affectedAddresses, 3, async (address) => {
        try {
          await evaluateMissions(address);
          return true;
        } catch (error) {
          console.error("Failed to evaluate missions after legacy verification", {
            address,
            error,
          });
          return false;
        }
      })
    : [];

  return {
    mode: input.apply ? "apply" : "dry-run",
    scope: input.scope,
    requestedLimit: limit,
    requestedOffset: offset,
    scanned: items.length,
    eligible: items.filter((item) => item.outcome === "eligible").length,
    verified: items.filter((item) => item.outcome === "verified").length,
    rejected: items.filter((item) => item.outcome === "rejected").length,
    unavailable: items.filter((item) => item.outcome === "unavailable").length,
    affectedAddresses,
    missionEvaluations: {
      requested: affectedAddresses.length,
      completed: evaluationResults.filter(Boolean).length,
      failed: evaluationResults.filter((completed) => !completed).length,
    },
    items,
  };
}
