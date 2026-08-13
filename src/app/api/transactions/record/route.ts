import { NextRequest, NextResponse } from "next/server";
import {
  formatUnits,
  getAddress,
  isAddressEqual,
  parseEventLogs,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { z } from "zod";

import { basePublicClient } from "@/lib/basePublicClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const tradeEventAbi = [
  {
    type: "event",
    name: "CoinBuy",
    inputs: [
      { name: "buyer", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "tradeReferrer", type: "address", indexed: true },
      { name: "coinsPurchased", type: "uint256", indexed: false },
      { name: "currency", type: "address", indexed: false },
      { name: "amountFee", type: "uint256", indexed: false },
      { name: "amountSold", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CoinSell",
    inputs: [
      { name: "seller", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "tradeReferrer", type: "address", indexed: true },
      { name: "coinsSold", type: "uint256", indexed: false },
      { name: "currency", type: "address", indexed: false },
      { name: "amountFee", type: "uint256", indexed: false },
      { name: "amountPurchased", type: "uint256", indexed: false },
    ],
  },
] as const;

const recordTradeSchema = z.object({
  tx_hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  user_address: z.string(),
  token_address: z.string(),
  type: z.enum(["buy", "sell"]),
});

type StoredTransactionIdentity = {
  id: string;
  tx_hash: string;
  user_address: string | null;
  token_address: string | null;
  type: string;
  verified_at: string | null;
};

type VerifiedTransactionIdentity = {
  userAddress: Address;
  tokenAddress: Address;
  type: "buy" | "sell";
};

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function safeDecimal(value: bigint, decimals: number): number {
  const parsed = Number(formatUnits(value, decimals));
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("The verified trade amount is outside supported limits.");
  }
  return parsed;
}

function isSameVerifiedTransaction(
  stored: StoredTransactionIdentity,
  verified: VerifiedTransactionIdentity
) {
  if (!stored.user_address || !stored.token_address) return false;

  try {
    return (
      isAddressEqual(getAddress(stored.user_address), verified.userAddress) &&
      isAddressEqual(getAddress(stored.token_address), verified.tokenAddress) &&
      stored.type === verified.type
    );
  } catch {
    return false;
  }
}

async function findStoredTransaction(txHash: string) {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("id, tx_hash, user_address, token_address, type, verified_at")
    // Legacy clients did not consistently normalize hexadecimal casing.
    .ilike("tx_hash", txHash)
    .maybeSingle();

  if (error) throw error;
  return data as StoredTransactionIdentity | null;
}

export async function POST(request: NextRequest) {
  let input: z.infer<typeof recordTradeSchema>;

  try {
    input = recordTradeSchema.parse(await request.json());
  } catch {
    return jsonError("Invalid transaction payload.", 400);
  }

  let requestedUser: Address;
  let requestedToken: Address;
  try {
    requestedUser = getAddress(input.user_address);
    requestedToken = getAddress(input.token_address);
  } catch {
    return jsonError("Invalid Base address.", 400);
  }

  try {
    const { data: storedCoin, error: coinError } = await supabaseAdmin
      .from("drawcoins")
      .select("contract_address")
      .ilike("contract_address", requestedToken)
      .not("verified_at", "is", null)
      .maybeSingle();

    if (coinError) throw coinError;
    if (!storedCoin) {
      return jsonError("This token is not a verified DrawCoin.", 404);
    }

    const tokenAddress = getAddress(storedCoin.contract_address);
    const receipt = await basePublicClient.getTransactionReceipt({
      hash: input.tx_hash as Hex,
    });

    if (receipt.status !== "success") {
      return jsonError("The Base transaction was not successful.", 422);
    }

    const decodedLogs = parseEventLogs({
      abi: tradeEventAbi,
      logs: receipt.logs.filter((log) =>
        isAddressEqual(log.address, tokenAddress)
      ),
    });
    const expectedEventName = input.type === "buy" ? "CoinBuy" : "CoinSell";
    const tradeLog = decodedLogs.find(
      (log) => log.eventName === expectedEventName
    );

    if (!tradeLog) {
      return jsonError(
        `No verified ${expectedEventName} event was found for this DrawCoin.`,
        422
      );
    }

    let rawTokenAmount: bigint;
    let rawCurrencyAmount: bigint;
    let currency: Address;

    if (tradeLog.eventName === "CoinBuy") {
      // The mission follows the recipient who actually received the coin.
      if (!isAddressEqual(tradeLog.args.recipient, requestedUser)) {
        return jsonError("The verified purchase belongs to another wallet.", 403);
      }
      rawTokenAmount = tradeLog.args.coinsPurchased;
      rawCurrencyAmount = tradeLog.args.amountSold;
      currency = tradeLog.args.currency;
    } else {
      if (!isAddressEqual(tradeLog.args.seller, requestedUser)) {
        return jsonError("The verified sale belongs to another wallet.", 403);
      }
      rawTokenAmount = tradeLog.args.coinsSold;
      rawCurrencyAmount = tradeLog.args.amountPurchased;
      currency = tradeLog.args.currency;
    }

    const tokenDecimals = await basePublicClient
      .readContract({
        address: tokenAddress,
        abi: [
          {
            type: "function",
            name: "decimals",
            stateMutability: "view",
            inputs: [],
            outputs: [{ type: "uint8" }],
          },
        ],
        functionName: "decimals",
      })
      .catch(() => 18);
    const amountToken = safeDecimal(rawTokenAmount, Number(tokenDecimals));

    // DrawCoin's existing analytics column is ETH-specific. Only record a
    // native-currency amount when the verified event identifies native ETH;
    // ERC-20 quote amounts remain verifiable but are not mislabeled as ETH.
    const amountEth = isAddressEqual(currency, zeroAddress)
      ? safeDecimal(rawCurrencyAmount, 18)
      : 0;
    const priceEth = amountToken > 0 ? amountEth / amountToken : 0;
    const normalizedUser = requestedUser.toLowerCase();
    const normalizedHash = input.tx_hash.toLowerCase();
    const verifiedAt = new Date().toISOString();
    const verifiedIdentity: VerifiedTransactionIdentity = {
      userAddress: requestedUser,
      tokenAddress,
      type: input.type,
    };
    const verifiedTransactionFields = {
      tx_hash: normalizedHash,
      user_address: normalizedUser,
      token_address: tokenAddress,
      type: input.type,
      amount_token: amountToken,
      amount_eth: amountEth,
      // USD values are not present in the receipt, so untrusted legacy values
      // are cleared rather than promoted into a verified transaction.
      amount_usd: 0,
      price_eth: priceEth,
      price_usd: 0,
      verified_at: verifiedAt,
    } as const;

    const existingTransaction = await findStoredTransaction(normalizedHash);
    let isVerifiedReplay = false;

    if (existingTransaction?.verified_at) {
      if (!isSameVerifiedTransaction(existingTransaction, verifiedIdentity)) {
        return jsonError(
          "This transaction hash is already registered to a different verified trade.",
          409
        );
      }

      // An exact replay is idempotent. In particular, do not reset analytics
      // fields that may have been enriched after the original verification.
      isVerifiedReplay = true;
    }

    const { error: userError } = await supabaseAdmin.from("users").upsert(
      { address: normalizedUser, last_active: verifiedAt },
      { onConflict: "address" }
    );
    if (userError) throw userError;

    if (!isVerifiedReplay) {
      if (existingTransaction) {
        const { data: upgradedTransaction, error: upgradeError } =
          await supabaseAdmin
            .from("transactions")
            .update(verifiedTransactionFields)
            .eq("id", existingTransaction.id)
            // Compare-and-set prevents a concurrent verifier from being
            // overwritten after it has established a verified identity.
            .is("verified_at", null)
            .select("id")
            .maybeSingle();

        if (upgradeError) throw upgradeError;

        if (!upgradedTransaction) {
          const concurrentTransaction =
            await findStoredTransaction(normalizedHash);
          if (
            !concurrentTransaction?.verified_at ||
            !isSameVerifiedTransaction(concurrentTransaction, verifiedIdentity)
          ) {
            return jsonError(
              "This transaction hash is already registered to a different verified trade.",
              409
            );
          }
        }
      } else {
        const { error: insertError } = await supabaseAdmin
          .from("transactions")
          .insert(verifiedTransactionFields);

        if (insertError) {
          // Another request may have inserted the same normalized hash between
          // our read and insert. Resolve the winner without ever overwriting it.
          if (insertError.code !== "23505") throw insertError;

          const concurrentTransaction =
            await findStoredTransaction(normalizedHash);
          if (
            !concurrentTransaction?.verified_at ||
            !isSameVerifiedTransaction(concurrentTransaction, verifiedIdentity)
          ) {
            return jsonError(
              "This transaction hash is already registered to a different verified trade.",
              409
            );
          }
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        verified: true,
        transaction: {
          hash: normalizedHash,
          type: input.type,
          tokenAddress,
          userAddress: normalizedUser,
          amountToken,
          amountEth,
          quoteCurrency: currency,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Failed to verify and record Base trade", error);
    return jsonError("Transaction verification is temporarily unavailable.", 503);
  }
}
