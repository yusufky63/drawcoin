import {
  createZoraCoin,
  getCoinAddressFromReceipt,
  CreateConstants,
} from "../../services/sdk/getCreateCoin.js";
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { showCreateMessages } from "../../utils/toastUtils";
import { toast } from "react-hot-toast";
import {
  BASE_CHAIN_ID,
  syncFreshCreation,
  syncCreatedToken,
  type CoinCreationCurrency,
  type CoinCreationRecordPayload,
  type CoinRecordError,
  type CoinRecordStatus,
} from "./coinCreationSync";

export { syncCreatedToken } from "./coinCreationSync";
export type {
  CoinCreationRecordPayload,
  CoinRecordError,
  CoinRecordErrorCode,
  CoinRecordResult,
  CoinRecordStatus,
} from "./coinCreationSync";

export interface CreateTokenData {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  category: string;
  creation_type?: "ai" | "hand-drawn";
  // Note: Initial purchase fields removed as not supported in SDK v2
  ownersAddresses: string[];
  selectedCurrency: number;
  platformReferrer: string;
}

export interface CreateTokenResult {
  hash: string;
  address?: string;
  receipt?: CoinCreationReceipt;
  deployment?: unknown;
  transactionHash: string;
  contractAddress?: string;
  recordStatus: CoinRecordStatus;
  recoveryPayload: CoinCreationRecordPayload;
  recordError?: CoinRecordError;
  recordedCoin?: Awaited<ReturnType<typeof syncCreatedToken>>["coin"];
}

type CoinCreationReceipt = {
  transactionHash?: string;
} & Record<string, unknown>;

type CreationWalletClient = {
  getChainId: () => Promise<number>;
};

export type PreparedCreateCall = {
  to: Address;
  data: Hex;
  value: bigint;
};

export type SendPreparedCreateCall = (
  call: PreparedCreateCall
) => Promise<Hex>;

export type SwitchToBaseAsync = (args: {
  chainId: typeof BASE_CHAIN_ID;
}) => Promise<unknown>;

export type CreateTokenErrorCode =
  | "BASE_SWITCH_REQUIRED"
  | "BASE_SWITCH_FAILED"
  | "TRANSACTION_CANCELLED"
  | "INSUFFICIENT_FUNDS"
  | "CREATION_STATUS_UNKNOWN"
  | "TOKEN_CREATION_FAILED";

export class CreateTokenError extends Error {
  constructor(
    readonly code: CreateTokenErrorCode,
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "CreateTokenError";
  }
}

const fallbackBasePublicClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
});

function selectBasePublicClient(publicClient: unknown) {
  if (
    publicClient &&
    typeof publicClient === "object" &&
    "chain" in publicClient &&
    publicClient.chain &&
    typeof publicClient.chain === "object" &&
    "id" in publicClient.chain &&
    publicClient.chain.id === base.id
  ) {
    return publicClient;
  }

  return fallbackBasePublicClient;
}

export const createToken = async (
  tokenData: CreateTokenData,
  walletClient: CreationWalletClient,
  publicClient: unknown,
  walletAddress: string,
  switchChainAsync?: SwitchToBaseAsync,
  sendPreparedCreateCall?: SendPreparedCreateCall
): Promise<CreateTokenResult> => {
  try {
    if (!isAddress(walletAddress) || !isAddress(tokenData.platformReferrer)) {
      throw new CreateTokenError(
        "TOKEN_CREATION_FAILED",
        "The creator or DrawCoin referral address is invalid. No transaction was sent.",
        false
      );
    }
    const normalizedWalletAddress = getAddress(walletAddress);
    const normalizedPlatformReferrer = getAddress(
      tokenData.platformReferrer
    );

    const initialChainId = await walletClient.getChainId();
    if (initialChainId !== base.id) {
      if (!switchChainAsync) {
        throw new CreateTokenError(
          "BASE_SWITCH_REQUIRED",
          "Switch your wallet to Base before creating the token.",
          false
        );
      }

      try {
        // Request a network switch once. A transaction is never submitted
        // until the wallet independently reports that Base is active.
        await switchChainAsync({ chainId: BASE_CHAIN_ID });
      } catch {
        throw new CreateTokenError(
          "BASE_SWITCH_FAILED",
          "The wallet could not switch to Base.",
          false
        );
      }
    }

    const confirmedChainId = await walletClient.getChainId();
    if (confirmedChainId !== base.id) {
      throw new CreateTokenError(
        "BASE_SWITCH_FAILED",
        "Base was not confirmed in the wallet. No transaction was sent.",
        false
      );
    }

    showCreateMessages.loading();

    const currencyString =
      tokenData.selectedCurrency === 0
        ? CreateConstants.ContentCoinCurrencies.ZORA
        : CreateConstants.ContentCoinCurrencies.ETH;
    const recordCurrency = currencyString as CoinCreationCurrency;

    // Use a Base-bound public client even when React has not yet re-rendered
    // the publicClient prop after the wallet switch.
    const baseClient = selectBasePublicClient(publicClient);
    if (!sendPreparedCreateCall) {
      throw new CreateTokenError(
        "TOKEN_CREATION_FAILED",
        "This wallet cannot submit a Base creation transaction.",
        false
      );
    }
    const sdkResult = (await createZoraCoin(
      {
        name: tokenData.name,
        symbol: tokenData.symbol,
        uri: tokenData.imageUrl,
        payoutRecipient: normalizedWalletAddress,
        currency: currencyString,
        chainId: BASE_CHAIN_ID,
        platformReferrer: normalizedPlatformReferrer,
        owners:
          tokenData.ownersAddresses.length > 0
            ? tokenData.ownersAddresses
            : undefined,
      },
      walletClient,
      baseClient,
      sendPreparedCreateCall
    )) as {
      hash?: string;
      address?: string;
      receipt?: CoinCreationReceipt;
      deployment?: unknown;
    };

    const transactionHash =
      sdkResult.hash ?? sdkResult.receipt?.transactionHash;
    if (
      typeof transactionHash !== "string" ||
      !/^0x[0-9a-fA-F]{64}$/.test(transactionHash)
    ) {
      throw new CreateTokenError(
        "CREATION_STATUS_UNKNOWN",
        "The wallet did not return a valid transaction ID. Check your activity before trying again.",
        false
      );
    }

    toast.success("Art token created successfully!", {
      id: "status-toast",
    });

    const extractedAddress = sdkResult.receipt
      ? getCoinAddressFromReceipt(sdkResult.receipt)
      : null;
    const rawContractAddress = sdkResult.address ?? extractedAddress ?? undefined;
    const contractAddress =
      rawContractAddress && isAddress(rawContractAddress)
        ? getAddress(rawContractAddress)
        : undefined;

    const recoveryPayload: CoinCreationRecordPayload = {
      name: tokenData.name,
      symbol: tokenData.symbol,
      description: tokenData.description,
      image_url: tokenData.imageUrl,
      creator_address: normalizedWalletAddress,
      tx_hash: transactionHash.toLowerCase(),
      chain_id: BASE_CHAIN_ID,
      currency: recordCurrency,
      platform_referrer: normalizedPlatformReferrer,
      ...(contractAddress ? { contract_address: contractAddress } : {}),
    };

    toast.loading("Syncing token with DrawCoin...", { id: "save-toast" });
    // This only repeats the idempotent server record step. It never resends
    // the wallet transaction or mints a second token.
    const recordResult = await syncFreshCreation(recoveryPayload);

    if (recordResult.status === "recorded") {
      toast.success("Token synced with DrawCoin.", { id: "save-toast" });
    } else {
      // The chain transaction remains successful. Return an explicit recovery
      // payload instead of converting this into a second mint attempt.
      toast.error(recordResult.error!.message, { id: "save-toast" });
    }

    return {
      ...sdkResult,
      hash: transactionHash,
      address: contractAddress ?? sdkResult.address,
      transactionHash,
      contractAddress,
      recordStatus: recordResult.status,
      recoveryPayload,
      recordError: recordResult.error,
      recordedCoin: recordResult.coin,
    };
  } catch (error) {
    console.error("Error creating token:", error);
    if (error instanceof CreateTokenError) {
      toast.error(error.message, { id: "status-toast" });
      throw error;
    }

    const raw = error instanceof Error ? error.message.toLowerCase() : "";
    if (
      raw.includes("user rejected") ||
      raw.includes("user denied") ||
      raw.includes("denied transaction") ||
      raw.includes("request rejected") ||
      raw.includes("rejected the request") ||
      raw.includes("token creation was rejected") ||
      raw.includes("token creation was cancelled")
    ) {
      const safeError = new CreateTokenError(
        "TRANSACTION_CANCELLED",
        "Transaction cancelled by user.",
        false
      );
      toast.error(safeError.message, { id: "status-toast" });
      throw safeError;
    }

    if (raw.includes("insufficient funds") || raw.includes("exceeds the balance")) {
      const safeError = new CreateTokenError(
        "INSUFFICIENT_FUNDS",
        "Insufficient funds for this transaction.",
        false
      );
      toast.error(safeError.message, { id: "status-toast" });
      throw safeError;
    }

    const statusUnknown =
      raw.includes("timeout") ||
      raw.includes("network") ||
      raw.includes("fetch failed") ||
      raw.includes("connection");
    const safeError = new CreateTokenError(
      statusUnknown ? "CREATION_STATUS_UNKNOWN" : "TOKEN_CREATION_FAILED",
      statusUnknown
        ? "The final transaction status is unclear. Check your wallet activity before trying again."
        : "Token creation failed. No transaction was retried.",
      false
    );
    toast.error(safeError.message, { id: "status-toast" });
    throw safeError;
  }
};
