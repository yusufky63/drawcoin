import { createZoraCoin, getCoinAddressFromReceipt, DeployCurrency } from '../../services/sdk/getCreateCoin.js';
import { CoinService, type CreateCoinData } from '../../services/coinService';
import { parseEther } from 'viem';
import { base } from 'viem/chains';
import { toast } from 'react-hot-toast';
import { checkAndSwitchNetwork } from '../../services/networkUtils';

export interface CreateTokenData {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  category: string;
  selectedPurchaseAmount: string;
  isPurchaseEnabled: boolean;
  ownersAddresses: string[];
  selectedCurrency: number;
  platformReferrer: string;
}

export interface CreateTokenResult {
  hash: string;
  address?: string;
  receipt?: any;
  deployment?: any;
}

export const createToken = async (
  tokenData: CreateTokenData,
  walletClient: any,
  publicClient: any,
  walletAddress: string,
  switchChain?: any
): Promise<CreateTokenResult> => {
  try {
    console.log("Creating token with data:", tokenData);

    // Check if we're on the Base network and auto-switch if needed
    const chainId = await walletClient.getChainId();
    if (chainId !== base.id) {
      console.log(`Chain mismatch: Connected to chain ${chainId}, but Base (${base.id}) is required. Attempting to switch...`);
      
      if (switchChain) {
        const switchSuccess = await checkAndSwitchNetwork({ chainId, switchChain });
        if (!switchSuccess) {
          throw new Error(`Please switch to Base network manually in your wallet.`);
        }
        // Wait a moment for the network switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        throw new Error(`Chain mismatch: Connected to chain ${chainId}, but Base (${base.id}) is required. Please switch networks.`);
      }
    }

    // Get user's selected purchase amount
    const purchaseAmount = parseEther(tokenData.selectedPurchaseAmount);
    console.log(`User selected purchase amount: ${purchaseAmount} wei`);

    // Show a loading toast for the creation process
    toast.loading("Creating your art token - this may take a moment...", {
      id: "status-toast",
      duration: 10000,
    });

    // Create Zora coin using updated SDK with the IPFS URI
    console.log("Creating coin with URI:", tokenData.imageUrl);
    console.log(
      "Using currency:",
      tokenData.selectedCurrency === DeployCurrency.ZORA ? "ZORA" : "ETH"
    );

    // Fee optimization: Use minimal gas settings
    const optimizedWalletClient = {
      ...walletClient,
      // Use wallet's optimal gas price instead of manual setting
      request: async (args: any) => {
        if (args.method === 'eth_sendTransaction') {
          // Let wallet optimize gas automatically
          return walletClient.request(args);
        }
        return walletClient.request(args);
      }
    };

    const result = await createZoraCoin(
      {
        name: tokenData.name,
        symbol: tokenData.symbol,
        uri: tokenData.imageUrl,
        payoutRecipient: walletAddress,
        currency: tokenData.selectedCurrency,
        chainId: chainId,
        platformReferrer: tokenData.platformReferrer || undefined,
        owners: tokenData.ownersAddresses.length > 0 ? tokenData.ownersAddresses : undefined,
        initialPurchaseWei: tokenData.isPurchaseEnabled ? purchaseAmount : BigInt(0),
      },
      optimizedWalletClient,
      publicClient
    ) as CreateTokenResult;

    console.log("Token created successfully:", result);

    // Update toast with success
    toast.success("Art token created successfully!", {
      id: "status-toast",
    });

    // Set the contract address from the result or extract from receipt
    let contractAddress = "";
    if (result && typeof result === "object" && "address" in result && result.address) {
      contractAddress = result.address;
    } else if (result && result.receipt) {
      const extractedAddress = getCoinAddressFromReceipt(result.receipt);
      contractAddress = extractedAddress || "Contract created, address unknown";
    } else {
      console.warn("Contract address not found in result:", result);
      contractAddress = "Contract created, address unknown";
    }

    // Save coin to database after successful creation
    if (contractAddress && contractAddress !== "Contract created, address unknown") {
      try {
        toast.loading("Saving token to database...", { id: "save-toast" });

        const coinData: CreateCoinData = {
          name: tokenData.name,
          symbol: tokenData.symbol,
          description: tokenData.description,
          contract_address: contractAddress,
          image_url: tokenData.imageUrl,
          category: tokenData.category,
          creator_address: walletAddress,
          creator_name: walletAddress,
          tx_hash: result.hash,
          chain_id: chainId,
          currency: tokenData.selectedCurrency === DeployCurrency.ZORA ? "ZORA" : "ETH",
          platform_referrer: tokenData.platformReferrer || undefined,
        };

        const savedCoin = await CoinService.saveCoin(coinData);

        if (savedCoin) {
          toast.success("Token saved to database successfully!", {
            id: "save-toast",
          });
        } else {
          toast.error("Failed to save token to database", {
            id: "save-toast",
          });
          console.error("Failed to save token to database");
        }
      } catch (error) {
        console.error("Error saving token to database:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        toast.error(`Database error: ${errorMessage}`, { id: "save-toast" });
      }
    }

    return result;
  } catch (error) {
    console.error("Error creating token:", error);
    const raw = error instanceof Error ? error.message : String(error || "");
    
    // Short, user-friendly messages
    if (
      raw.toLowerCase().includes("user rejected") ||
      raw.toLowerCase().includes("user denied") ||
      raw.toLowerCase().includes("denied transaction") ||
      raw.toLowerCase().includes("request rejected") ||
      raw.toLowerCase().includes("rejected the request")
    ) {
      const shortMsg = "Transaction cancelled by user.";
      toast.error(shortMsg, { id: "status-toast" });
      throw new Error(shortMsg);
    } else if (
      raw.toLowerCase().includes("insufficient funds") ||
      raw.toLowerCase().includes("exceeds the balance")
    ) {
      toast.error("Insufficient funds.", { id: "status-toast" });
      throw new Error("Insufficient funds.");
    } else {
      const concise = raw.length > 120 ? `${raw.slice(0, 117)}...` : raw;
      toast.error(concise, { id: "status-toast" });
      throw new Error(concise);
    }
  }
};

