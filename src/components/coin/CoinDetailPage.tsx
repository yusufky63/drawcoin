"use client";

import React, { useState, useEffect } from "react";
import {
  useAccount,
  useWalletClient,
  usePublicClient,
  useSwitchChain,
} from "wagmi";
import { formatEther, erc20Abi } from "viem";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Coin } from "../../lib/supabase";
import { getCoinDetails } from "../../services/sdk/getCoins";
import { getGeckoTerminalPool } from "../../services/sdk/getGeckoData";
import { getETHPrice } from "../../services/cryptoPrice";
import TradeSuccessModal from "../market/TradeSuccessModal";
import { useWatchlist } from "../../hooks/useWatchlist";
import CoinShareModal from "./CoinShareModal";
import HandDrawnSkeleton from "../ui/HandDrawnSkeleton";

// New Components
import { CoinHeader } from "./details/CoinHeader";
import { CoinVisuals } from "./details/CoinVisuals";
import { CoinSummaryCard } from "./details/CoinSummaryCard";
import { CoinTradeCard } from "./details/CoinTradeCard";
import { CoinInfoSection } from "./details/CoinInfoSection";

interface CoinDetailPageProps {
  token: Coin;
  onBack?: () => void;
}

export default function CoinDetailPage({ token, onBack }: CoinDetailPageProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();
  const { isWatchlisted, toggleWatchlist } = useWatchlist();

  // State
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState<string>("");
  const [slippage, setSlippage] = useState(0.05); // 5% default slippage
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [ethBalance, setEthBalance] = useState<string>("0");
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [selectedCurrency, setSelectedCurrency] = useState<"ETH" | "USDC">(
    "ETH"
  );
  const [usdcBalance, setUsdcBalance] = useState<string>("0");
  const [showTokenSelect, setShowTokenSelect] = useState(false);
  const [availableTokens, setAvailableTokens] = useState<
    Array<{ symbol: string; address: string; balance: string }>
  >([]);
  const [marketData, setMarketData] = useState<any>(null);
  const [poolAddress, setPoolAddress] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isCreator, setIsCreator] = useState<boolean>(false);

  // Helper function to resolve price numbers
  const resolvePriceNumber = (value: any) => {
    if (value === null || value === undefined) return undefined;
    const parsed = typeof value === "number" ? value : parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  // Calculate watchlist price hint from state
  const watchlistPriceHint = {
    priceUsd: resolvePriceNumber(
      marketData?.tokenPrice?.priceInUsdc ??
        marketData?.tokenPrice?.priceInUsd ??
        token.current_price
    ),
    priceEth: resolvePriceNumber(
      marketData?.tokenPrice?.priceInPoolToken ??
        marketData?.tokenPrice?.priceInEth
    ),
  };

  const isFavorite = isWatchlisted(token.contract_address);

  // Token addresses on Base
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

  // Initial loading - removed artificial delay
  useEffect(() => {
    setInitialLoading(false);
  }, []);

  // Fetch pool address from GeckoTerminal
  useEffect(() => {
    const fetchPool = async () => {
      if (token.contract_address) {
        try {
          const poolAddress = await getGeckoTerminalPool(
            token.contract_address
          );
          if (poolAddress) {
            setPoolAddress(poolAddress);
          }
        } catch (error) {
          console.error("Error fetching pool:", error);
        }
      }
    };
    fetchPool();
  }, [token.contract_address]);

  // Fetch Onchain Data
  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const market = await getCoinDetails(token.contract_address);

        if (mounted) {
          if (market) setMarketData(market);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [token.contract_address]);

  // Fetch ETH Price
  useEffect(() => {
    const fetchEthPrice = async () => {
      const price = await getETHPrice();
      if (price) setEthPrice(price);
    };
    fetchEthPrice();
  }, []);

  // Fetch Balances
  const fetchBalances = async () => {
    if (!address || !publicClient) return;

    try {
      // ETH Balance
      const ethBal = await publicClient.getBalance({ address });
      setEthBalance(parseFloat(formatEther(ethBal)).toFixed(4));

      // Token Balance
      const tokenBal = await publicClient.readContract({
        address: token.contract_address as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      });
      setTokenBalance(parseFloat(formatEther(tokenBal as bigint)).toFixed(4));

      // USDC Balance
      const usdcBal = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      });
      setUsdcBalance(parseFloat(formatEther(usdcBal as bigint)).toFixed(4));

      // Update available tokens list
      setAvailableTokens([
        {
          symbol: "ETH",
          address: "0x0000000000000000000000000000000000000000",
          balance: parseFloat(formatEther(ethBal)).toFixed(4),
        },
        {
          symbol: "USDC",
          address: USDC_ADDRESS,
          balance: parseFloat(formatEther(usdcBal as bigint)).toFixed(4),
        },
      ]);

      // Check Creator Status
      if (token.creatorAddress) {
        setIsCreator(
          address.toLowerCase() === token.creatorAddress.toLowerCase()
        );
      }
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchBalances();
      const interval = setInterval(fetchBalances, 30000);
      return () => clearInterval(interval);
    }
  }, [isConnected, address, token.contract_address]);

  // Handle Trade
  const handleTrade = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      // Check wallet and public clients
      if (!publicClient || !walletClient) {
        toast.error("Wallet client not available");
        return;
      }
      const chainId = await publicClient.getChainId();

      // Check if we're on Base mainnet (8453)
      if (chainId !== 8453) {
        try {
          await switchChain({ chainId: 8453 });
        } catch (switchError) {
          toast.error("Please switch to Base network");
          return;
        }
      }

      // Import trade execution function
      const { executeTrade } = await import("../../services/sdk/getTradeCoin");

      const tradeParams = {
        direction: tradeType, // 'buy' or 'sell'
        coinAddress: token.contract_address,
        amountIn: amount, // Keep as string
        recipient: address!,
        slippage,
        walletClient,
        publicClient,
        account: address!,
        switchChain,
        creatorAddress: token.creator_address || null,
      };

      console.log("Executing trade with params:", tradeParams);

      const result = (await executeTrade(tradeParams)) as any;

      // executeTrade returns transaction receipt, check for hash
      if (result && (result.transactionHash || result.hash)) {
        const txHash = result.transactionHash || result.hash;
        toast.success(
          `${
            tradeType === "buy" ? "Purchase" : "Sale"
          } successful! Tx: ${txHash.substring(0, 10)}...`
        );

        // Analytics is already handled in getTradeCoin.js executeUniversalTrade
        console.log("✅ Trade completed, analytics handled by SDK");

        setShowSuccessModal(true);
        setAmount(""); // Clear amount

        // Refresh balances after a short delay
        setTimeout(() => {
          fetchBalances();
        }, 2000);
      } else {
        console.error("Trade result:", result);
        toast.error("Trade failed - no transaction hash received");
      }
    } catch (error: any) {
      console.error("Trade error:", error);

      // Handle specific error types
      if (error.message?.includes("User rejected")) {
        toast.error("Transaction cancelled by user");
      } else if (error.message?.includes("insufficient funds")) {
        toast.error("Insufficient balance for this trade");
      } else if (error.message?.includes("slippage")) {
        toast.error("Price moved too much. Try increasing slippage tolerance.");
      } else {
        toast.error(error.message || "Trade failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate USD Value
  const usdValue = amount
    ? parseFloat(amount) *
      (tradeType === "buy"
        ? selectedCurrency === "ETH"
          ? ethPrice
          : 1 // USDC is approx $1
        : parseFloat(marketData?.tokenPrice?.priceInUsdc || "0"))
    : 0;

  // Max Balance for Slider - with Creator restrictions
  const maxBalance = (() => {
    if (tradeType === "buy") {
      return selectedCurrency === "ETH"
        ? parseFloat(ethBalance)
        : parseFloat(usdcBalance);
    } else {
      // Sell case
      const currentTokenBalance = parseFloat(tokenBalance);

      if (isCreator) {
        // Creator restriction: 10M tokens are reserved (locked)
        const CREATOR_RESERVED_TOKENS = 10_000_000;
        const availableTokens = Math.max(
          0,
          currentTokenBalance - CREATOR_RESERVED_TOKENS
        );

        // Use 99.5% of available tokens to prevent precision errors
        return availableTokens * 0.995;
      } else {
        // Regular user: use 99.9% to prevent precision errors
        return currentTokenBalance * 0.999;
      }
    }
  })();

  // Show skeleton on initial load
  if (initialLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4">
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex justify-between items-center">
            <HandDrawnSkeleton variant="circle" className="w-10 h-10" />
            <div className="flex gap-2">
              <HandDrawnSkeleton variant="circle" className="w-10 h-10" />
              <HandDrawnSkeleton variant="circle" className="w-10 h-10" />
            </div>
          </div>

          {/* Content Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
            {/* Left Side - Visual Skeleton */}
            <div className="lg:col-span-6 space-y-4">
              <div className="hand-drawn-card p-4 animate-pulse">
                <div className="w-full h-96 bg-art-gray-200 rounded-art" />
              </div>
              <div className="hand-drawn-card p-4 animate-pulse">
                <div className="w-full h-64 bg-art-gray-200 rounded-art" />
              </div>
            </div>

            {/* Right Side - Trade Card Skeleton */}
            <div className="lg:col-span-4">
              <div className="hand-drawn-card p-4 animate-pulse space-y-4">
                <HandDrawnSkeleton variant="text" className="w-3/4 h-8" />
                <HandDrawnSkeleton variant="text" className="w-1/2 h-6" />
                <div className="space-y-2">
                  <HandDrawnSkeleton variant="text" className="w-full h-12" />
                  <HandDrawnSkeleton variant="text" className="w-full h-12" />
                  <HandDrawnSkeleton variant="text" className="w-full h-16" />
                </div>
              </div>
            </div>
          </div>

          {/* Info Section Skeleton */}
          <HandDrawnSkeleton variant="table" count={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* Header Actions (Top of Page) */}
      <div className="flex justify-between items-center mb-4">
        {/* Back Button */}
        <button
          onClick={onBack || (() => router.back())}
          className="p-2 transform -rotate-1 hover:scale-105 transition-transform bg-white border-2 border-art-gray-900 shadow-[3px_3px_0px_#2d3748] hover:shadow-[4px_4px_0px_#2d3748] active:shadow-[1px_1px_0px_#2d3748] active:translate-y-[1px]"
          style={{
            borderRadius: "50%",
            width: "40px",
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            className="w-5 h-5 text-art-gray-900"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>

        {/* Right Actions */}
        <div className="flex gap-2">
          <button
            onClick={() =>
              toggleWatchlist(token.contract_address, watchlistPriceHint)
            }
            className={`p-2 transform rotate-1 hover:scale-105 transition-transform bg-white border-2 border-art-gray-900 shadow-[3px_3px_0px_#2d3748] hover:shadow-[4px_4px_0px_#2d3748] active:shadow-[1px_1px_0px_#2d3748] active:translate-y-[1px] ${
              isFavorite
                ? "text-red-500"
                : "text-art-gray-400 hover:text-red-400"
            }`}
            style={{
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              className="w-5 h-5"
              fill={isFavorite ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className="p-2 transform -rotate-1 hover:scale-105 transition-transform bg-white border-2 border-art-gray-900 shadow-[3px_3px_0px_#2d3748] hover:shadow-[4px_4px_0px_#2d3748] active:shadow-[1px_1px_0px_#2d3748] active:translate-y-[1px] text-art-gray-400 hover:text-blue-500"
            style={{
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12 gap-4">
        {/* Left Side - Visuals (Image, Chart, Trades) - Larger on desktop */}
        <div className="lg:col-span-2 xl:col-span-7">
          <CoinVisuals
            token={token}
            poolAddress={poolAddress}
            totalSupply={marketData?.totalSupply || token.totalSupply}
          />
        </div>

        {/* Right Side - Merged Interaction Panel - Smaller but adequate */}
        <div className="lg:col-span-1 xl:col-span-5">
          <div className="hand-drawn-card p-4 sticky top-4">
            {/* Header Section (Title Inside) */}
            <CoinHeader token={token} />
            {/* Mini Summary Section */}
            <CoinSummaryCard token={token} marketData={marketData} />

            {/* Divider */}
            <div className="border-t-2 border-dashed border-art-gray-200 my-4 mx-2" />

            {/* Trade Section */}
            <CoinTradeCard
              token={token}
              tradeType={tradeType}
              setTradeType={setTradeType}
              amount={amount}
              setAmount={setAmount}
              slippage={slippage}
              setSlippage={setSlippage}
              showSlippageSettings={showSlippageSettings}
              setShowSlippageSettings={setShowSlippageSettings}
              ethBalance={ethBalance}
              tokenBalance={tokenBalance}
              usdcBalance={usdcBalance}
              selectedCurrency={selectedCurrency}
              setSelectedCurrency={setSelectedCurrency}
              showTokenSelect={showTokenSelect}
              setShowTokenSelect={setShowTokenSelect}
              availableTokens={availableTokens}
              handleTrade={handleTrade}
              loading={loading}
              isConnected={isConnected}
              isCreator={isCreator}
              usdValue={usdValue}
              maxBalance={maxBalance}
            />
          </div>
        </div>
      </div>

      {/* Token Details Section - Full Width */}
      <div className="mt-2">
        <CoinInfoSection
          token={token}
          marketData={marketData}
          poolAddress={poolAddress}
        />
      </div>

      {/* Modals */}
      <TradeSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        tradeType={tradeType}
        amount={amount}
        token={token}
        tokenPrice={marketData?.tokenPrice?.priceInUsdc}
      />

      <CoinShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        tokenName={token.name}
        tokenSymbol={token.symbol}
        tokenAddress={token.contract_address}
        tokenImage={token.image_url}
        marketCap={
          marketData?.marketCap
            ? parseFloat(marketData.marketCap).toLocaleString()
            : "0"
        }
        price={
          marketData?.tokenPrice?.priceInUsdc
            ? parseFloat(marketData.tokenPrice.priceInUsdc).toFixed(8)
            : "0"
        }
        volume24h={
          marketData?.volume24h
            ? parseFloat(marketData.volume24h).toLocaleString()
            : "0"
        }
        priceChange24h={(() => {
          const marketCap = parseFloat(marketData?.marketCap);
          const delta24h = parseFloat(marketData?.marketCapDelta24h);
          if (marketCap && delta24h) {
            if (marketCap === delta24h) return 100;
            const previousMC = marketCap - delta24h;
            if (previousMC > 0) {
              return (delta24h / previousMC) * 100;
            }
          }
          return 0;
        })()}
      />
    </div>
  );
}
