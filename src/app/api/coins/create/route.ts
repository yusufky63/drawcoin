import { NextRequest, NextResponse } from "next/server";
import {
  CreateConstants,
  getCoinCreateFromLogs,
} from "@zoralabs/coins-sdk";
import { coinFactoryAddress } from "@zoralabs/protocol-deployments";
import {
  getAddress,
  isAddressEqual,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { z } from "zod";

import { basePublicClient } from "@/lib/basePublicClient";
import { ApiInputError, readJsonBody } from "@/lib/api/requestValidation";
import {
  requireWalletSession,
  SessionError,
} from "@/lib/auth/session";
import { DRAWCOIN_PLATFORM_REFERRER } from "@/lib/drawcoinPlatform";
import type { CoinRecordErrorCode } from "@/lib/functions/coinCreationSync";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ZORA's Base currency address is stable across the supported Coins SDK 0.4.1
// deployment tree. The SDK does not export it from the public entrypoint, so
// keep the exact onchain value beside verification and fail closed otherwise.
const ZORA_BASE_CURRENCY_ADDRESS = getAddress(
  "0x1111111111166b7fe7bd91427724b487980afc69"
);

type VerifiedCreationCurrency = "ETH" | "ZORA";

const createCoinSchema = z.object({
  name: z.string().trim().min(1).max(100),
  symbol: z.string().trim().min(1).max(20),
  description: z.string().trim().min(1).max(2_000),
  contract_address: z.string().trim().optional(),
  image_url: z.string().trim().min(1).max(4_096),
  category: z.string().trim().min(1).max(80).default("DrawCoin"),
  creator_address: z.string().trim(),
  creator_name: z.string().trim().max(100).optional().nullable(),
  tx_hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  chain_id: z.literal(base.id).optional().default(base.id),
  currency: z
    .enum(["ETH", "ZORA", "CREATOR_COIN", "CREATOR_COIN_OR_ZORA"])
    .optional()
    .default("ZORA"),
  platform_referrer: z.string().trim(),
});

type StoredCoinIdentity = {
  id: string;
  contract_address: string;
  creator_address: string;
  tx_hash: string;
  verified_at: string | null;
};

type StoredCreateTransactionIdentity = {
  id: string;
  tx_hash: string;
  user_address: string | null;
  token_address: string | null;
  type: string;
  verified_at: string | null;
};

function jsonError(
  error: string,
  status: number,
  code: CoinRecordErrorCode
) {
  return NextResponse.json(
    { error, code },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function isSameVerifiedCreation(
  stored: StoredCoinIdentity,
  transactionHash: string,
  creatorAddress: Address,
  contractAddress: Address
) {
  try {
    return (
      stored.tx_hash.toLowerCase() === transactionHash.toLowerCase() &&
      isAddressEqual(getAddress(stored.creator_address), creatorAddress) &&
      isAddressEqual(getAddress(stored.contract_address), contractAddress)
    );
  } catch {
    return false;
  }
}

async function findStoredCoin(contractAddress: Address) {
  const { data, error } = await supabaseAdmin
    .from("drawcoins")
    .select("*")
    // Legacy clients did not normalize hexadecimal address casing.
    .ilike("contract_address", contractAddress)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function isSameCanonicalCreateTransaction(
  stored: StoredCreateTransactionIdentity,
  transactionHash: string,
  creatorAddress: Address,
  contractAddress: Address
) {
  if (!stored.user_address || !stored.token_address) return false;

  try {
    return (
      stored.tx_hash.toLowerCase() === transactionHash.toLowerCase() &&
      stored.type === "create" &&
      isAddressEqual(getAddress(stored.user_address), creatorAddress) &&
      isAddressEqual(getAddress(stored.token_address), contractAddress)
    );
  } catch {
    return false;
  }
}

async function findStoredCreateTransaction(transactionHash: string) {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("id, tx_hash, user_address, token_address, type, verified_at")
    // Legacy clients did not consistently normalize hexadecimal casing.
    .ilike("tx_hash", transactionHash)
    .maybeSingle();

  if (error) throw error;
  return data as StoredCreateTransactionIdentity | null;
}

function verifyCreationCurrency(
  requestedCurrency: z.infer<typeof createCoinSchema>["currency"],
  eventCurrency: Address
): VerifiedCreationCurrency | null {
  if (
    requestedCurrency === CreateConstants.ContentCoinCurrencies.ZORA &&
    isAddressEqual(eventCurrency, ZORA_BASE_CURRENCY_ADDRESS)
  ) {
    return "ZORA";
  }

  if (
    requestedCurrency === CreateConstants.ContentCoinCurrencies.ETH &&
    isAddressEqual(eventCurrency, zeroAddress)
  ) {
    return "ETH";
  }

  // CoinCreatedV4 exposes only the selected token address, which cannot
  // unambiguously reconstruct the CREATOR_COIN_OR_ZORA request mode. DrawCoin's
  // current surface creates ZORA pairs, so unsupported modes are rejected.
  return null;
}

export async function POST(request: NextRequest) {
  let input: z.infer<typeof createCoinSchema>;
  let session;

  try {
    session = await requireWalletSession();
  } catch (error) {
    if (error instanceof SessionError) {
      return jsonError(
        error.message,
        error.status,
        "WALLET_SESSION_REQUIRED"
      );
    }
    return jsonError(
      "Wallet sign-in is temporarily unavailable.",
      503,
      "WALLET_SESSION_UNAVAILABLE"
    );
  }

  try {
    const body = await readJsonBody<unknown>(request, 16_384);
    input = createCoinSchema.parse(body);
  } catch (error) {
    if (error instanceof ApiInputError) {
      return jsonError(error.message, error.status, "INVALID_RECORD_PAYLOAD");
    }
    return jsonError(
      "Invalid coin creation payload.",
      400,
      "INVALID_RECORD_PAYLOAD"
    );
  }

  let requestedContractAddress: Address | undefined;
  let creatorAddress: Address;
  try {
    requestedContractAddress = input.contract_address
      ? getAddress(input.contract_address)
      : undefined;
    creatorAddress = getAddress(input.creator_address);
  } catch {
    return jsonError("Invalid Base address.", 400, "INVALID_RECORD_PAYLOAD");
  }

  let requestedPlatformReferrer: Address;
  try {
    requestedPlatformReferrer = getAddress(input.platform_referrer);
  } catch {
    return jsonError(
      "Invalid platform referrer address.",
      400,
      "INVALID_RECORD_PAYLOAD"
    );
  }

  if (!isAddressEqual(creatorAddress, session.address)) {
    return jsonError(
      "The verified wallet does not match the coin creator.",
      403,
      "CREATOR_MISMATCH"
    );
  }
  if (
    !isAddressEqual(
      requestedPlatformReferrer,
      DRAWCOIN_PLATFORM_REFERRER
    )
  ) {
    return jsonError(
      "This creation is not attributed to DrawCoin.",
      422,
      "PLATFORM_REFERRER_MISMATCH"
    );
  }

  try {
    const receipt = await basePublicClient.getTransactionReceipt({
      hash: input.tx_hash as Hex,
    });

    if (receipt.status !== "success") {
      return jsonError(
        "The Base transaction was not successful.",
        422,
        "TRANSACTION_NOT_CONFIRMED"
      );
    }

    // Only accept CoinCreatedV4 logs emitted by Zora's official Base factory.
    // Filtering before the SDK parser prevents look-alike events from an
    // arbitrary contract from being trusted as a DrawCoin creation.
    const officialFactory = coinFactoryAddress[base.id];
    const deployment = getCoinCreateFromLogs({
      ...receipt,
      logs: receipt.logs.filter((log) =>
        isAddressEqual(log.address, officialFactory)
      ),
    });

    if (!deployment) {
      return jsonError(
        "No official Zora CoinCreatedV4 event was found in this transaction.",
        422,
        "ONCHAIN_CREATION_MISMATCH"
      );
    }

    const eventCoin = getAddress(deployment.coin);
    const eventCaller = getAddress(deployment.caller);
    const eventCurrency = getAddress(deployment.currency);
    const eventPlatformReferrer = getAddress(deployment.platformReferrer);
    const verifiedCurrency = verifyCreationCurrency(
      input.currency,
      eventCurrency
    );
    const matchesCreator = isAddressEqual(creatorAddress, eventCaller);
    const matchesPlatformReferrer =
      isAddressEqual(requestedPlatformReferrer, eventPlatformReferrer) &&
      isAddressEqual(eventPlatformReferrer, DRAWCOIN_PLATFORM_REFERRER);

    if (
      (requestedContractAddress &&
        !isAddressEqual(requestedContractAddress, eventCoin)) ||
      !matchesCreator ||
      !matchesPlatformReferrer ||
      !verifiedCurrency ||
      deployment.name !== input.name ||
      deployment.symbol !== input.symbol ||
      deployment.uri !== input.image_url
    ) {
      return jsonError(
        "Coin details do not match the verified Base transaction.",
        422,
        "ONCHAIN_CREATION_MISMATCH"
      );
    }

    const bytecode = await basePublicClient.getCode({ address: eventCoin });
    if (!bytecode || bytecode === "0x") {
      return jsonError(
        "The created coin contract is not deployed on Base.",
        422,
        "ONCHAIN_CREATION_MISMATCH"
      );
    }

    const normalizedCreator = creatorAddress.toLowerCase();
    const normalizedHash = input.tx_hash.toLowerCase();
    const verifiedAt = new Date().toISOString();

    const verifiedCoinFields = {
      name: deployment.name,
      symbol: deployment.symbol,
      description: input.description,
      contract_address: eventCoin,
      image_url: deployment.uri,
      category: "DrawCoin",
      creator_address: normalizedCreator,
      creator_name: normalizedCreator,
      tx_hash: normalizedHash,
      chain_id: base.id,
      // Persist the backwards-compatible label only after its exact onchain
      // currency address has been verified above.
      currency: verifiedCurrency,
      platform_referrer: eventPlatformReferrer,
      verified_at: verifiedAt,
    } as const;

    const verifiedTransactionFields = {
      tx_hash: normalizedHash,
      user_address: normalizedCreator,
      token_address: eventCoin,
      type: "create",
      amount_token: 0,
      amount_eth: 0,
      amount_usd: 0,
      price_eth: 0,
      price_usd: 0,
      verified_at: verifiedAt,
    } as const;

    const [existingCoin, existingTransaction] = await Promise.all([
      findStoredCoin(eventCoin),
      findStoredCreateTransaction(normalizedHash),
    ]);

    if (
      existingCoin?.verified_at &&
      !isSameVerifiedCreation(
        existingCoin,
        input.tx_hash,
        creatorAddress,
        eventCoin
      )
    ) {
      return jsonError(
        "This contract is already registered as a different verified DrawCoin.",
        409,
        "RECORD_CONFLICT"
      );
    }

    if (
      existingTransaction &&
      !isSameCanonicalCreateTransaction(
        existingTransaction,
        normalizedHash,
        creatorAddress,
        eventCoin
      )
    ) {
      return jsonError(
        "This transaction hash is already registered to a different activity.",
        409,
        "RECORD_CONFLICT"
      );
    }

    const { error: userError } = await supabaseAdmin.from("users").upsert(
      {
        address: normalizedCreator,
        last_active: verifiedAt,
      },
      { onConflict: "address" }
    );

    if (userError) throw userError;

    let coin;
    if (existingCoin?.verified_at) {
      // Replays are idempotent and never reset live market statistics or
      // rewrite creator/metadata fields.
      coin = existingCoin;
    } else if (existingCoin) {
      // Preserve the row's original artwork classification. Onchain
      // verification proves the DrawCoin creation, not how its image was made.
      const { data, error } = await supabaseAdmin
        .from("drawcoins")
        .update(verifiedCoinFields)
        .eq("id", existingCoin.id)
        // Compare-and-set prevents a concurrent verifier from replacing a
        // verified identity between our read and update.
        .is("verified_at", null)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (data) {
        coin = data;
      } else {
        const concurrentCoin = await findStoredCoin(eventCoin);
        if (
          !concurrentCoin?.verified_at ||
          !isSameVerifiedCreation(
            concurrentCoin,
            input.tx_hash,
            creatorAddress,
            eventCoin
          )
        ) {
          return jsonError(
            "This contract is already registered as a different verified DrawCoin.",
            409,
            "RECORD_CONFLICT"
          );
        }
        coin = concurrentCoin;
      }
    } else {
      const { data, error } = await supabaseAdmin
        .from("drawcoins")
        .insert({
          ...verifiedCoinFields,
          // The current first-party creation surface is canvas-only. This is
          // display metadata; mission eligibility is based on verified_at.
          creation_type: "hand-drawn",
          holders: 1,
          current_price: 0,
          volume_24h: 0,
          total_supply: 0,
          last_synced_at: verifiedAt,
        })
        .select()
        .maybeSingle();

      if (error) {
        // The unique contract address may have been inserted by an identical
        // retry between our read and insert. Re-check the winner and accept
        // only the exact verified creation.
        if (error.code !== "23505") throw error;

        const concurrentCoin = await findStoredCoin(eventCoin);
        if (
          !concurrentCoin?.verified_at ||
          !isSameVerifiedCreation(
            concurrentCoin,
            input.tx_hash,
            creatorAddress,
            eventCoin
          )
        ) {
          return jsonError(
            "This contract is already registered as a different verified DrawCoin.",
            409,
            "RECORD_CONFLICT"
          );
        }
        coin = concurrentCoin;
      } else if (!data) {
        throw new Error("Verified coin insert returned no row.");
      } else {
        coin = data;
      }
    }

    if (!existingTransaction?.verified_at) {
      if (existingTransaction) {
        const { data: upgradedTransaction, error: upgradeError } =
          await supabaseAdmin
            .from("transactions")
            .update(verifiedTransactionFields)
            .eq("id", existingTransaction.id)
            // Compare-and-set prevents a concurrent verifier from replacing
            // the canonical create identity established by this receipt.
            .is("verified_at", null)
            .select("id")
            .maybeSingle();

        if (upgradeError) throw upgradeError;

        if (!upgradedTransaction) {
          const concurrentTransaction =
            await findStoredCreateTransaction(normalizedHash);
          if (
            !concurrentTransaction?.verified_at ||
            !isSameCanonicalCreateTransaction(
              concurrentTransaction,
              normalizedHash,
              creatorAddress,
              eventCoin
            )
          ) {
            return jsonError(
              "This transaction hash is already registered to a different activity.",
              409,
              "RECORD_CONFLICT"
            );
          }
        }
      } else {
        const { error: insertError } = await supabaseAdmin
          .from("transactions")
          .insert(verifiedTransactionFields);

        if (insertError) {
          // Another request may have inserted this hash after our preflight.
          // Accept only an exact, already-verified canonical create replay.
          if (insertError.code !== "23505") throw insertError;

          const concurrentTransaction =
            await findStoredCreateTransaction(normalizedHash);
          if (
            !concurrentTransaction?.verified_at ||
            !isSameCanonicalCreateTransaction(
              concurrentTransaction,
              normalizedHash,
              creatorAddress,
              eventCoin
            )
          ) {
            return jsonError(
              "This transaction hash is already registered to a different activity.",
              409,
              "RECORD_CONFLICT"
            );
          }
        }
      }
    }

    return NextResponse.json(
      { success: true, data: coin, verified: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Failed to verify and save Base coin creation", error);
    return jsonError(
      "Coin verification is temporarily unavailable.",
      503,
      "VERIFICATION_UNAVAILABLE"
    );
  }
}
