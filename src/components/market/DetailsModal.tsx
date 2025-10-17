import React, { useEffect, useState } from "react";
import { Coin } from "../../lib/supabase";
import { getOnchainTokenDetails } from "../../services/sdk/getOnchainData";
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useSwitchChain,
} from "wagmi";
import {
  executeTrade,
  executeERC20Trade,
} from "../../services/sdk/getTradeCoin";
import { getETHPrice } from "../../services/ethPrice.js";
import { toast } from "react-hot-toast";
import TradeSuccessModal from "./TradeSuccessModal";

interface DetailsModalProps {
  token: Coin | null;
  isOpen: boolean;
  onClose: () => void;
  onTrade?: (token: Coin) => void;
  onTradeSuccess?: () => void;
}

export default function DetailsModal({
  token,
  isOpen,
  onClose,
  onTrade,
  onTradeSuccess,
}: DetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  // Tabs: trade | details (info + image)
  const [activeTab, setActiveTab] = useState<"trade" | "details">("trade");
  const [showImageModal, setShowImageModal] = useState(false);

  // Reset to trade tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab("trade");
    }
  }, [isOpen]);

  // Trade state
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(0.05); // 5% default slippage (max: 30%)
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [trading, setTrading] = useState(false);
  const [ethBalance, setEthBalance] = useState<string>("0");
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [isCreator, setIsCreator] = useState<boolean>(false);
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [selectedCurrency, setSelectedCurrency] = useState<"ETH" | "USDC">(
    "ETH"
  );
  const [usdcBalance, setUsdcBalance] = useState<string>("0");
  const [showTokenSelect, setShowTokenSelect] = useState(false);
  const [availableTokens, setAvailableTokens] = useState<
    Array<{ symbol: string; address: string; balance: string }>
  >([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Token addresses on Base
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

  // Allow external trigger to open Trade tab with direction
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      const detail: any = ce.detail || {};
      const addr = (detail.address || "").toLowerCase();
      if (!token?.contract_address) return;
      if (addr !== token.contract_address.toLowerCase()) return;
      setActiveTab("trade");
      if (detail.direction === "buy" || detail.direction === "sell") {
        setTradeType(detail.direction);
      }
    };
    window.addEventListener("openTrade", handler as any);
    return () => window.removeEventListener("openTrade", handler as any);
  }, [token?.contract_address]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!isOpen || !token?.contract_address) return;
      setLoading(true);
      setError(null);
      try {
        const details = await getOnchainTokenDetails(
          token.contract_address,
          address
        );
        if (!mounted) return;
        if (details && !(details as any).hasError) {
          setData(details);
        } else {
          setData(null);
          setError(
            (details as any)?.rateLimited
              ? "Rate limited. Try again shortly."
              : (details as any)?.error || "Failed to load details"
          );
        }
      } catch (e: any) {
        if (!mounted) return;
        setData(null);
        setError(e?.message || "Failed to load details");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [isOpen, token?.contract_address, address]);

  // Fetch ETH balance
  useEffect(() => {
    const fetchEthBalance = async () => {
      if (isOpen && address && publicClient) {
        try {
          const balance = await publicClient.getBalance({ address });
          const ethBalance = (Number(balance) / 10 ** 18).toFixed(4);
          setEthBalance(ethBalance);
          console.log("ETH Balance:", ethBalance);
        } catch (error) {
          console.error("Failed to fetch ETH balance:", error);
          setEthBalance("0");
        }
      }
    };
    fetchEthBalance();
  }, [isOpen, address, publicClient]);

  // Fetch USDC and ZORA balances
  useEffect(() => {
    const fetchTokenBalances = async () => {
      if (isOpen && address && publicClient) {
        try {
          // Fetch USDC balance
          const usdcBalance = await publicClient.readContract({
            address: USDC_ADDRESS as `0x${string}`,
            abi: [
              {
                constant: true,
                inputs: [{ name: "_owner", type: "address" }],
                name: "balanceOf",
                outputs: [{ name: "balance", type: "uint256" }],
                type: "function",
              },
            ],
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          });
          setUsdcBalance((Number(usdcBalance) / 10 ** 6).toFixed(2)); // USDC has 6 decimals
        } catch (error) {
          console.error("Failed to fetch token balances:", error);
          setUsdcBalance("0");
        }
      }
    };
    fetchTokenBalances();
  }, [isOpen, address, publicClient]);

  // Fetch available tokens for selection
  useEffect(() => {
    const fetchAvailableTokens = async () => {
      if (isOpen && address && publicClient) {
        try {
          const tokens = [
            { symbol: "ETH", address: "ETH", balance: ethBalance },
            { symbol: "USDC", address: USDC_ADDRESS, balance: usdcBalance },
          ];
          setAvailableTokens(tokens);
        } catch (error) {
          console.error("Failed to fetch available tokens:", error);
        }
      }
    };
    fetchAvailableTokens();
  }, [isOpen, address, publicClient, ethBalance, usdcBalance]);

  // Fetch Token balance
  useEffect(() => {
    const fetchTokenBalance = async () => {
      if (isOpen && address && publicClient && token?.contract_address) {
        try {
          const balance = await publicClient.readContract({
            address: token.contract_address as `0x${string}`,
            abi: [
              {
                constant: true,
                inputs: [{ name: "_owner", type: "address" }],
                name: "balanceOf",
                outputs: [{ name: "balance", type: "uint256" }],
                type: "function",
              },
            ],
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          });

          let tokenBalance = (Number(balance) / 10 ** 18).toFixed(4);

          // If user is the creator, filter out the 10M initial supply
          const creatorAddress =
            (token as any).creatorAddress || (token as any).creator_address;
          const userIsCreator =
            creatorAddress &&
            address.toLowerCase() === creatorAddress.toLowerCase();
          setIsCreator(userIsCreator);

          if (userIsCreator) {
            const totalSupply = parseFloat(
              (token as any).totalSupply ||
                (token as any).total_supply ||
                "10000000000"
            );
            const initialSupply = 10000000; // 10M tokens
            const availableBalance = Math.max(
              0,
              parseFloat(tokenBalance) - initialSupply
            );
            tokenBalance = availableBalance.toFixed(4);
            console.log(
              "Creator detected - filtered 10M initial supply. Available balance:",
              tokenBalance
            );
          }

          setTokenBalance(tokenBalance);
          console.log("Token Balance:", tokenBalance);
        } catch (error) {
          console.error("Failed to fetch token balance:", error);
          setTokenBalance("0");
        }
      }
    };
    fetchTokenBalance();
  }, [isOpen, address, publicClient, token?.contract_address]);

  // Fetch ETH price
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const price = await getETHPrice();
        setEthPrice(price);
        console.log("ETH Price:", price);
      } catch (error) {
        console.error("Failed to fetch ETH price:", error);
        // Keep default price of 0
      }
    };
    fetchEthPrice();
  }, [isOpen]);

  if (!isOpen || !token) return null;
  // Simple chart URL for Base network

  // Refresh balances function
  const refreshBalances = async () => {
    if (!address || !publicClient || !token?.contract_address) return;

    try {
      // Refresh ETH balance
      const ethBalance = await publicClient.getBalance({ address });
      setEthBalance((Number(ethBalance) / 1e18).toFixed(4));

      // Refresh USDC balance
      const usdcBalance = await publicClient.readContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: [
          {
            constant: true,
            inputs: [{ name: "_owner", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "balance", type: "uint256" }],
            type: "function",
          },
        ],
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
      setUsdcBalance((Number(usdcBalance) / 10 ** 6).toFixed(2));

      // Refresh token balance
      const tokenBalance = await publicClient.readContract({
        address: token.contract_address as `0x${string}`,
        abi: [
          {
            constant: true,
            inputs: [{ name: "_owner", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "balance", type: "uint256" }],
            type: "function",
          },
        ],
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });

      let refreshedBalance = (Number(tokenBalance) / 10 ** 18).toFixed(4);

      // If user is the creator, filter out the 10M initial supply
      const creatorAddress =
        (token as any).creatorAddress || (token as any).creator_address;
      if (
        creatorAddress &&
        address.toLowerCase() === creatorAddress.toLowerCase()
      ) {
        const initialSupply = 10000000; // 10M tokens
        const availableBalance = Math.max(
          0,
          parseFloat(refreshedBalance) - initialSupply
        );
        refreshedBalance = availableBalance.toFixed(4);
      }

      setTokenBalance(refreshedBalance);
    } catch (error) {
      console.error("Error refreshing balances:", error);
    }
  };

  const handleTrade = async () => {
    if (!token || !isConnected || !address || !walletClient || !publicClient)
      return;
    if (!amount || parseFloat(amount) <= 0) return;

    // Token addresses on Base
    const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

    const toastId = toast.loading(
      tradeType === "buy" 
        ? `Preparing to buy ${token.symbol} with ${selectedCurrency}...`
        : `Preparing to sell ${token.symbol}... Checking permissions and generating permit signature. If this takes longer than expected, we'll automatically retry.`,
      {
        id: "trade-toast",
        duration: 0, // Don't auto-dismiss loading toast
      }
    );

    try {
      setTrading(true);
      if (tradeType === "buy") {
        // Buying with different currencies
        if (selectedCurrency === "ETH") {
          // ETH to Token
          await executeTrade({
            direction: "buy",
            coinAddress: token.contract_address,
            amountIn: amount,
            recipient: address,
            slippage,
            walletClient,
            publicClient,
            account: address,
            switchChain,
          });
        } else {
          // USDC to Token
          const sellTokenAddress = USDC_ADDRESS;
          const decimals = 6;
          const amountInBigInt = BigInt(
            Math.floor(parseFloat(amount) * Math.pow(10, decimals))
          );

          // Update toast message for ERC20 trades
          toast.loading(
            `Approving ${selectedCurrency} for trading... This may require 2 transactions.`,
            {
              id: toastId,
              duration: 0,
            }
          );

          await executeERC20Trade({
            sellTokenAddress,
            buyTokenAddress: token.contract_address,
            amountIn: amountInBigInt,
            recipient: address,
            slippage,
            walletClient,
            publicClient,
            account: address,
            switchChain,
          });
        }
      } else {
        // Selling token for ETH
        
        // Update toast message for sell operations
        toast.loading(
          `Preparing to sell ${token.symbol}... Checking permissions and generating permit signature. If this takes longer than expected, we'll automatically retry.`,
          {
            id: toastId,
            duration: 0,
          }
        );
        
        await executeTrade({
          direction: "sell",
          coinAddress: token.contract_address,
          amountIn: amount,
          recipient: address,
          slippage,
          walletClient,
          publicClient,
          account: address,
          switchChain,
        } as any);
      }

      // Success toast
      toast.success(
        `🎉 ${tradeType === "buy" ? "Buy" : "Sell"} successful! ${parseFloat(
          amount
        ).toFixed(4)} ${
          tradeType === "buy" ? selectedCurrency : token.symbol
        } ${tradeType === "buy" ? "purchased" : "sold"}`,
        {
          id: toastId,
          duration: 4000,
        }
      );

      // Show success modal
      setShowSuccessModal(true);

      // Refresh balances after successful trade
      await refreshBalances();
      
      // Notify parent component about successful trade
      if (onTradeSuccess) {
        onTradeSuccess();
      }

      // Refresh balances after successful trade
      try {
        const refreshed = await getOnchainTokenDetails(
          token.contract_address,
          address
        );
        setData(refreshed);

        // Refresh ETH balance
        const ethBalance = await publicClient.getBalance({ address });
        setEthBalance((Number(ethBalance) / 10 ** 18).toFixed(4));

        // Refresh USDC balance
        const usdcBalance = await publicClient.readContract({
          address: USDC_ADDRESS as `0x${string}`,
          abi: [
            {
              constant: true,
              inputs: [{ name: "_owner", type: "address" }],
              name: "balanceOf",
              outputs: [{ name: "balance", type: "uint256" }],
              type: "function",
            },
          ],
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        });
        setUsdcBalance((Number(usdcBalance) / 10 ** 6).toFixed(2));

        // Refresh token balance
        const tokenBalance = await publicClient.readContract({
          address: token.contract_address as `0x${string}`,
          abi: [
            {
              constant: true,
              inputs: [{ name: "_owner", type: "address" }],
              name: "balanceOf",
              outputs: [{ name: "balance", type: "uint256" }],
              type: "function",
            },
          ],
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        });

        let refreshedBalance = (Number(tokenBalance) / 10 ** 18).toFixed(4);

        // If user is the creator, filter out the 10M initial supply
        const creatorAddress =
          (token as any).creatorAddress || (token as any).creator_address;
        if (
          creatorAddress &&
          address.toLowerCase() === creatorAddress.toLowerCase()
        ) {
          const initialSupply = 10000000; // 10M tokens
          const availableBalance = Math.max(
            0,
            parseFloat(refreshedBalance) - initialSupply
          );
          refreshedBalance = availableBalance.toFixed(4);
        }

        setTokenBalance(refreshedBalance);

        // Clear amount input
        setAmount("");
      } catch {}
    } catch (e: any) {
      console.error("Trade error:", e);

      // User-friendly error messages
      let errorMessage = "Transaction failed";

      if (
        e?.message?.includes("User rejected") ||
        e?.message?.includes("denied transaction")
      ) {
        errorMessage = "Transaction cancelled by user";
      } else if (e?.message?.includes("insufficient funds")) {
        errorMessage = "Insufficient funds";
      } else if (e?.message?.includes("gas")) {
        errorMessage = "Transaction failed - try again";
      } else if (
        e?.message?.includes("Quote failed") ||
        e?.message?.includes("500")
      ) {
        errorMessage = "Token not ready for trading yet";
      } else if (e?.message?.includes("Internal Server Error")) {
        errorMessage = "Service temporarily unavailable";
      } else if (e?.message) {
        // Keep original message but make it shorter
        errorMessage =
          e.message.length > 50
            ? e.message.substring(0, 50) + "..."
            : e.message;
      }

      // Error toast
      toast.error(
        `❌ ${tradeType === "buy" ? "Buy" : "Sell"} failed: ${errorMessage}`,
        {
          id: toastId,
          duration: 4000,
        }
      );
    } finally {
      setTrading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2">
      <div
        className="hand-drawn-card w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        style={{
          transform: "rotate(-0.5deg)",
          maxWidth: "900px",
          maxHeight: "700px",
        }}
      >
        {/* Sticky Tabs + Close */}
        <div
          className="sticky top-0 z-10 bg-white border-b-2 border-art-gray-900 px-4 py-3 flex items-center justify-between"
          style={{ borderStyle: "dashed" }}
        >
          <div
            className="inline-flex items-center gap-1 border-2 border-art-gray-900 rounded-art p-1"
            style={{ borderRadius: "15px 5px 10px 8px" }}
          >
            {(["trade", "details"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-2 text-xs font-bold transition-all duration-200 ${
                  activeTab === t
                    ? "bg-art-gray-900 text-white"
                    : "text-art-gray-600 hover:text-art-gray-800"
                }`}
                style={{
                  transform: activeTab === t ? "rotate(-1deg)" : "rotate(1deg)",
                  borderRadius: "8px 2px 6px 4px",
                }}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="text-art-gray-400 hover:text-art-gray-600 transform rotate-1"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ strokeWidth: 2 }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-2 overflow-y-auto flex-1 space-y-2">
          {activeTab === "trade" ? (
            <>
              <div
                className="hand-drawn-card p-2 md:p-4"
                style={{ transform: "rotate(-0.3deg)" }}
              >
                {/* Buy/Sell Toggle */}
                <div
                  className="mb-4 flex items-center border-2 border-art-gray-900 rounded-art p-1"
                  style={{ borderRadius: "15px 5px 10px 8px" }}
                >
                  <button
                    onClick={() => setTradeType("buy")}
                    className={`hand-drawn-btn w-full text-sm font-bold ${
                      tradeType === "buy" ? "secondary" : ""
                    }`}
                    style={{
                      transform:
                        tradeType === "buy" ? "rotate(-1deg)" : "rotate(1deg)",
                      backgroundColor:
                        tradeType === "buy" ? undefined : "transparent",
                      color: tradeType === "buy" ? undefined : "#2d3748",
                    }}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setTradeType("sell")}
                    className={`hand-drawn-btn w-full text-sm font-bold ${
                      tradeType === "sell" ? "danger" : ""
                    }`}
                    style={{
                      transform:
                        tradeType === "sell" ? "rotate(-1deg)" : "rotate(1deg)",
                      backgroundColor:
                        tradeType === "sell" ? undefined : "transparent",
                      color: tradeType === "sell" ? undefined : "#2d3748",
                    }}
                  >
                    Sell
                  </button>
                </div>

                {/* Slippage Setting - Toggle */}
                <div className="mb-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-art-gray-500">
                      Slippage: {Math.round(slippage * 100)}%
                    </div>
                    <button
                      onClick={() =>
                        setShowSlippageSettings(!showSlippageSettings)
                      }
                      className="text-xs text-art-gray-600 hover:text-art-gray-800 transform rotate-1"
                    >
                      {showSlippageSettings ? "Hide" : "Custom"}
                    </button>
                  </div>

                  {showSlippageSettings && (
                    <div
                      className="mt-2 p-3 bg-art-gray-50 rounded-art transform -rotate-0.5"
                      style={{ borderRadius: "10px 5px 8px 6px" }}
                    >
                      <div className="space-y-2">
                        <div className="text-xs text-art-gray-600 font-bold">
                          Slippage Tolerance
                        </div>

                        {/* Quick Slippage Options */}
                        <div className="flex gap-2">
                          {[0.01, 0.05, 0.1, 0.5].map((value) => (
                            <button
                              key={value}
                              onClick={() => setSlippage(value)}
                              className={`px-2 py-1 text-xs font-bold transition-all duration-200 ${
                                slippage === value
                                  ? "bg-art-gray-900 text-white"
                                  : "bg-white text-art-gray-700 hover:bg-art-gray-100"
                              }`}
                              style={{
                                borderRadius: "6px 2px 4px 3px",
                                transform:
                                  slippage === value
                                    ? "rotate(-1deg)"
                                    : "rotate(0.5deg)",
                                border: "1px solid #2d3748",
                              }}
                            >
                              {Math.round(value * 100)}%
                            </button>
                          ))}
                        </div>

                        {/* Custom Slippage Input */}
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0.1"
                            max="30"
                            step="0.1"
                            value={slippage * 100}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (
                                !isNaN(value) &&
                                value >= 0.1 &&
                                value <= 30
                              ) {
                                setSlippage(value / 100);
                              }
                            }}
                            className="hand-drawn-input flex-1 text-xs"
                            style={{ padding: "0.5rem" }}
                            placeholder="Custom %"
                          />
                          <span className="text-xs text-art-gray-500">%</span>
                        </div>

                        <div className="text-xs text-art-gray-500">
                          {slippage < 0.01 &&
                            "⚠️ Very low slippage may cause failed transactions"}
                          {slippage > 0.1 &&
                            "⚠️ High slippage may result in unfavorable prices"}
                          {slippage > 0.2 &&
                            "⚠️ Very high slippage - consider reducing amount"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Amount Input with Currency Selection */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-bold text-art-gray-600 transform -rotate-0.5">
                        Amount
                      </label>
                      <div className="text-xs text-art-gray-500">
                        {tradeType === "buy"
                          ? `Your ${selectedCurrency}: ${(() => {
                              switch (selectedCurrency) {
                                case "ETH":
                                  return `${ethBalance} ETH`;
                                case "USDC":
                                  return `${usdcBalance} USDC`;
                                default:
                                  return `${ethBalance} ETH`;
                              }
                            })()}`
                          : `Your ${token.symbol}: ${tokenBalance} ${token.symbol}`}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {/* Amount Input */}
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={tradeType === "buy" ? "0.00" : "0"}
                        className="hand-drawn-input flex-1 text-sm"
                      />
                      {/* Currency Selection */}
                      {tradeType === "buy" && (
                        <button
                          onClick={() => setShowTokenSelect(true)}
                          className="hand-drawn-btn text-sm font-bold py-2 px-3 transform rotate-1 flex-shrink-0"
                          style={{
                            padding: "0.5rem 0.75rem",
                            borderRadius: "8px 3px 6px 4px",
                            minWidth: "80px",
                          }}
                        >
                          {selectedCurrency}
                        </button>
                      )}
                    </div>
                    {/* USD Value Display */}
                    {amount && (
                      <div className="mt-1 text-xs text-art-gray-500">
                        ≈ $
                        {(() => {
                          if (tradeType === "buy") {
                            if (selectedCurrency === "USDC") {
                              // USDC is already in USD
                              return parseFloat(amount).toFixed(2);
                            } else if (selectedCurrency === "ETH") {
                              // ETH to USD conversion
                              return (parseFloat(amount) * ethPrice).toFixed(2);
                            }
                          } else {
                            // Token to USD conversion
                            const tokenPrice = (token as any).tokenPrice
                              ?.priceInUsdc;
                            return tokenPrice
                              ? (
                                  parseFloat(amount) * parseFloat(tokenPrice)
                                ).toFixed(2)
                              : "—";
                          }
                        })()}{" "}
                        USD
                      </div>
                    )}
                  </div>

                  {/* Amount Slider */}
                  <div>
                    <label className="block text-sm font-bold text-art-gray-600 mb-2 transform rotate-0.5">
                      Amount Slider
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={(() => {
                        if (!amount) return "0";
                        const maxBalance =
                          tradeType === "buy"
                            ? (() => {
                                switch (selectedCurrency) {
                                  case "ETH":
                                    return parseFloat(ethBalance);
                                  case "USDC":
                                    return parseFloat(usdcBalance);
                                  default:
                                    return parseFloat(ethBalance);
                                }
                              })()
                            : parseFloat(tokenBalance);
                        if (maxBalance === 0) return "0";
                        return (
                          (parseFloat(amount) / maxBalance) *
                          100
                        ).toString();
                      })()}
                      onChange={(e) => {
                        const percentage = parseFloat(e.target.value) / 100;
                        const maxBalance =
                          tradeType === "buy"
                            ? (() => {
                                switch (selectedCurrency) {
                                  case "ETH":
                                    return parseFloat(ethBalance);
                                  case "USDC":
                                    return parseFloat(usdcBalance);
                                  default:
                                    return parseFloat(ethBalance);
                                }
                              })()
                            : parseFloat(tokenBalance);
                        // For 100%, use 99.9% to avoid precision issues
                        const adjustedPercentage = percentage === 1 ? 0.999 : percentage;
                        const newAmount = (maxBalance * adjustedPercentage).toFixed(4);
                        setAmount(newAmount);
                      }}
                      className="hand-drawn-input w-full h-3"
                      style={{
                        background: (() => {
                          const maxBalance =
                            tradeType === "buy"
                              ? (() => {
                                  switch (selectedCurrency) {
                                    case "ETH":
                                      return parseFloat(ethBalance);
                                    case "USDC":
                                      return parseFloat(usdcBalance);
                                    default:
                                      return parseFloat(ethBalance);
                                  }
                                })()
                              : parseFloat(tokenBalance);
                          if (!amount || !maxBalance)
                            return "linear-gradient(to right, #e2e8f0 0%, #e2e8f0 100%)";
                          const percentage =
                            (parseFloat(amount) / maxBalance) * 100;
                          return `linear-gradient(to right, #4299e1 0%, #4299e1 ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`;
                        })(),
                      }}
                    />
                    <div className="flex justify-between text-xs text-art-gray-500 mt-1">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Quick Percentage Buttons */}
                  <div>
                    <label className="block text-sm font-bold text-art-gray-600 mb-2 transform -rotate-0.5">
                      Quick Amount
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[0.25, 0.5, 0.75, 1].map((p, index) => (
                        <button
                          key={p}
                          onClick={() => {
                            const maxBalance =
                              tradeType === "buy"
                                ? (() => {
                                    switch (selectedCurrency) {
                                      case "ETH":
                                        return parseFloat(ethBalance);
                                      case "USDC":
                                        return parseFloat(usdcBalance);
                                      default:
                                        return parseFloat(ethBalance);
                                    }
                                  })()
                                : parseFloat(tokenBalance);
                            // For 100%, use 99.9% to avoid precision issues
                            const percentage = p === 1 ? 0.999 : p;
                            const newAmount = (maxBalance * percentage).toFixed(4);
                            setAmount(newAmount);
                          }}
                          className="hand-drawn-btn text-xs font-bold"
                          style={{
                            padding: "0.5rem 0.75rem",
                            transform: `rotate(${
                              index % 2 === 0 ? "1deg" : "-1deg"
                            })`,
                          }}
                        >
                          {Math.round(p * 100)}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Creator Restriction Notice */}
                  {tradeType === "sell" && isCreator && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-art p-3 mb-4">
                      <div className="flex items-center">
                        <svg
                          className="w-4 h-4 text-yellow-600 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"
                          />
                        </svg>
                        <div>
                          <p className="text-sm text-yellow-800 font-medium">
                            Creator Restriction
                          </p>
                          <p className="text-xs text-yellow-600 mt-1">
                            Only{" "}
                            <strong>
                              {parseFloat(tokenBalance).toLocaleString()}
                            </strong>{" "}
                            tokens can be sold right now. The initial 10M tokens
                            are locked.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Trade Summary */}
                  {amount && (
                    <div
                      className="bg-art-gray-50 p-2 rounded-art transform rotate-0.3"
                      style={{ borderRadius: "8px 6px 10px 4px" }}
                    >
                      <div className="text-xs text-art-gray-600">
                        {tradeType === "buy" ? "Buy" : "Sell"}{" "}
                        {parseFloat(amount).toFixed(4)}{" "}
                        {tradeType === "buy" ? selectedCurrency : token.symbol}
                        <span className="text-art-gray-500 ml-2">
                          ≈ $
                          {(() => {
                            if (tradeType === "buy") {
                              if (selectedCurrency === "USDC") {
                                // USDC is already in USD
                                return parseFloat(amount).toFixed(2);
                              } else if (selectedCurrency === "ETH") {
                                // ETH to USD conversion
                                return (parseFloat(amount) * ethPrice).toFixed(
                                  2
                                );
                              }
                            } else {
                              const tokenPrice = (token as any).tokenPrice
                                ?.priceInUsdc;
                              return tokenPrice
                                ? (
                                    parseFloat(amount) * parseFloat(tokenPrice)
                                  ).toFixed(2)
                                : "—";
                            }
                          })()}{" "}
                          USD
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Wallet Connection Status */}
                  {!isConnected && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-art p-3 mb-4">
                      <div className="flex items-center">
                        <svg
                          className="w-4 h-4 text-yellow-600 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                          />
                        </svg>
                        <p className="text-xs text-yellow-800">
                          Please connect your wallet to trade
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ERC20 Token Info */}
                  {tradeType === "buy" && selectedCurrency !== "ETH" && (
                    <div className="border rounded-art p-3 mb-4 bg-blue-50 border-blue-200">
                      <div className="flex items-center">
                        <svg
                          className="w-4 h-4 mr-2 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <p className="text-xs text-blue-800">
                          {selectedCurrency} trading may require 2 transactions:
                          approval + trade
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Trade Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleTrade}
                      disabled={trading || !amount || !isConnected}
                      className={`hand-drawn-btn w-full text-sm font-bold ${
                        tradeType === "buy" ? "secondary" : "danger"
                      }`}
                      style={{
                        padding: "0.75rem 1.5rem",
                        transform: "rotate(-0.5deg)",
                        opacity: !amount || !isConnected ? 0.5 : 1,
                      }}
                    >
                      {trading ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Processing...
                        </div>
                      ) : !isConnected ? (
                        "Connect Wallet"
                      ) : (
                        `${tradeType === "buy" ? "Buy" : "Sell"} ${
                          token.symbol
                        }`
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Token Header with Image */}
              <div
                className="hand-drawn-card p-4 mb-4"
                style={{ transform: "rotate(0.2deg)" }}
              >
                <div className="flex items-center gap-4">
                  {/* Token Image Icon */}
                  <div
                    className="overflow-hidden bg-art-gray-50 cursor-pointer flex-shrink-0"
                    style={{
                      border: "2px solid #2d3748",
                      borderRadius: "15px 5px 10px 8px",
                      transform: "rotate(0.5deg)",
                      width: "60px",
                      height: "60px",
                    }}
                    onClick={() => setShowImageModal(true)}
                  >
                    {(() => {
                      const imageUrl =
                        (token as any).mediaContent?.previewImage?.small ||
                        token.image_url;
                      return imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={token.name || "Token Image"}
                          className="w-full h-full object-contain bg-white"
                          style={{ borderRadius: "13px 3px 8px 6px" }}
                          onError={(e) => {
                            const target = e.currentTarget;
                            const nextSibling =
                              target.nextElementSibling as HTMLElement;
                            if (nextSibling) {
                              target.style.display = "none";
                              nextSibling.style.display = "flex";
                            }
                          }}
                        />
                      ) : null;
                    })()}
                    {(() => {
                      const imageUrl =
                        (token as any).mediaContent?.previewImage?.small ||
                        token.image_url;
                      return !imageUrl ? (
                        <div className="w-full h-full flex items-center justify-center text-art-gray-400">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            style={{ strokeWidth: 2 }}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* Token Info */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-art-gray-900 truncate">
                      {token.name || "Unknown Token"}
                    </h2>
                    <p className="text-sm text-art-gray-500 font-mono">
                      {token.symbol || "UNKNOWN"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-art-gray-100 text-art-gray-800">
                        Zora Token
                      </span>
                      <span className="text-xs text-art-gray-500">
                        Base Chain
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Token Stats */}
              <div
                className="hand-drawn-card p-4 mb-4"
                style={{ transform: "rotate(0.3deg)" }}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Price */}
                  <div
                    className="bg-art-gray-50 p-3 rounded-art transform rotate-1"
                    style={{ borderRadius: "12px 4px 8px 6px" }}
                  >
                    <div className="text-art-gray-500 text-xs">
                      Price (USDC)
                    </div>
                    <div className="text-art-gray-900 font-bold text-sm">
                      {(() => {
                        const price = (token as any).tokenPrice?.priceInUsdc;
                        return price ? `$${parseFloat(price).toFixed(8)}` : "—";
                      })()}
                    </div>
                  </div>
                  {/* Market Cap */}
                  <div
                    className="bg-art-gray-50 p-3 rounded-art transform rotate-0.5"
                    style={{ borderRadius: "10px 5px 15px 8px" }}
                  >
                    <div className="text-art-gray-500 text-xs">Market Cap</div>
                    <div className="text-art-gray-900 font-bold text-sm">
                      {(() => {
                        const mc = (token as any).marketCap;
                        return mc ? `$${parseFloat(mc).toFixed(2)}` : "—";
                      })()}
                    </div>
                  </div>
                  {/* 24h Volume */}
                  <div
                    className="bg-art-gray-50 p-3 rounded-art transform -rotate-0.5"
                    style={{ borderRadius: "15px 3px 10px 7px" }}
                  >
                    <div className="text-art-gray-500 text-xs">24h Volume</div>
                    <div className="text-art-gray-900 font-bold text-sm">
                      {(() => {
                        const vol = (token as any).volume24h;
                        return vol ? `$${parseFloat(vol).toFixed(2)}` : "—";
                      })()}
                    </div>
                  </div>
                  {/* Total Volume */}
                  <div
                    className="bg-art-gray-50 p-3 rounded-art transform rotate-1"
                    style={{ borderRadius: "6px 8px 12px 4px" }}
                  >
                    <div className="text-art-gray-500 text-xs">
                      Total Volume
                    </div>
                    <div className="text-art-gray-900 font-bold text-sm">
                      {(() => {
                        const vol = (token as any).totalVolume;
                        return vol ? `$${parseFloat(vol).toFixed(2)}` : "—";
                      })()}
                    </div>
                  </div>
                  {/* Holders */}
                  <div
                    className="bg-art-gray-50 p-3 rounded-art transform -rotate-1"
                    style={{ borderRadius: "12px 6px 8px 10px" }}
                  >
                    <div className="text-art-gray-500 text-xs">Holders</div>
                    <div className="text-art-gray-900 font-bold text-sm">
                      {(token as any).uniqueHolders || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Token Details */}
              <div
                className="hand-drawn-card p-4 mb-4"
                style={{ transform: "rotate(-0.2deg)" }}
              >
                <div className="grid grid-cols-2 gap-3">
                  {/* Total Supply */}
                  <div
                    className="bg-art-gray-50 p-3 rounded-art transform rotate-0.5"
                    style={{ borderRadius: "10px 5px 15px 8px" }}
                  >
                    <div className="text-art-gray-500 text-xs">
                      Total Supply
                    </div>
                    <div className="text-art-gray-900 font-bold text-sm">
                      {(() => {
                        const supply = (token as any).totalSupply;
                        return supply
                          ? `${(parseFloat(supply) / 1000000).toFixed(2)}M`
                          : "—";
                      })()}
                    </div>
                  </div>
                  {/* Created */}
                  <div
                    className="bg-art-gray-50 p-3 rounded-art transform -rotate-0.5"
                    style={{ borderRadius: "15px 3px 10px 7px" }}
                  >
                    <div className="text-art-gray-500 text-xs">Created</div>
                    <div className="text-art-gray-900 font-bold text-sm">
                      {(() => {
                        const created = (token as any).createdAt;
                        return created
                          ? new Date(created).toLocaleDateString()
                          : "—";
                      })()}
                    </div>
                  </div>
                  {/* Chain ID */}
                  <div
                    className="bg-art-gray-50 p-3 rounded-art transform rotate-1"
                    style={{ borderRadius: "6px 8px 12px 4px" }}
                  >
                    <div className="text-art-gray-500 text-xs">Chain</div>
                    <div className="text-art-gray-900 font-bold text-sm">
                      {(() => {
                        const chainId = (token as any).chainId;
                        return chainId === 8453 ? "Base" : `Chain ${chainId}`;
                      })()}
                    </div>
                  </div>
                  {/* Token Address */}
                  <div
                    className="bg-art-gray-50 p-3 rounded-art transform -rotate-1"
                    style={{ borderRadius: "12px 6px 8px 10px" }}
                  >
                    <div className="text-art-gray-500 text-xs">
                      Token Address
                    </div>
                    <div className="text-art-gray-900 font-mono text-xs">
                      {token.contract_address
                        ? `${token.contract_address.slice(
                            0,
                            6
                          )}...${token.contract_address.slice(-4)}`
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Creator Info */}
              <div
                className="hand-drawn-card p-4 mb-4"
                style={{ transform: "rotate(-0.2deg)" }}
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-art-gray-500 text-xs mb-1">
                      Creator
                    </div>
                    <div className="text-art-gray-900 font-bold text-sm">
                      {(token as any).creatorProfile?.handle || "Unknown"}
                    </div>
                    <div className="text-art-gray-500 text-xs font-mono">
                      {(token as any).creatorAddress
                        ? `${(token as any).creatorAddress.slice(0, 6)}...${(
                            token as any
                          ).creatorAddress.slice(-4)}`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-art-gray-500 text-xs mb-1">
                      Pool Currency
                    </div>
                    <div className="text-art-gray-900 font-bold text-sm">
                      {(token as any).poolCurrencyToken?.name || "ZORA"}
                    </div>
                    <div className="text-art-gray-500 text-xs">
                      {(token as any).poolCurrencyToken?.decimals || 18}{" "}
                      decimals
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div
                className="hand-drawn-card p-4 mb-4"
                style={{ transform: "rotate(0.1deg)" }}
              >
                <div className="text-art-gray-500 text-xs mb-2">
                  Description
                </div>
                <div className="text-art-gray-900 text-sm leading-relaxed">
                  {(token as any).description || "No description available"}
                </div>
              </div>

              {/* External Links */}
              <div
                className="hand-drawn-card p-4"
                style={{ transform: "rotate(-0.3deg)" }}
              >
                <div className="space-y-3">
                  <a
                    href={`https://zora.co/coin/base:${token.contract_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hand-drawn-btn w-full text-center block"
                    style={{
                      padding: "0.75rem 1.5rem",
                      transform: "rotate(0.5deg)",
                      backgroundColor: "#2d3748",
                      color: "white",
                      textDecoration: "none",
                    }}
                  >
                    View on Zora
                  </a>
                  <a
                    href={`https://dexscreener.com/base/${token.contract_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hand-drawn-btn w-full text-center block"
                    style={{
                      padding: "0.75rem 1.5rem",
                      transform: "rotate(-0.3deg)",
                      backgroundColor: "#4299e1",
                      color: "white",
                      textDecoration: "none",
                    }}
                  >
                    View on DexScreener
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Large Image Modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 z-10"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ strokeWidth: 2 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            {(() => {
              const imageUrl =
                (token as any).mediaContent?.previewImage?.medium ||
                (token as any).mediaContent?.previewImage?.small ||
                token.image_url;
              return imageUrl ? (
                <img
                  src={imageUrl}
                  alt={token.name || "Token Image"}
                  className="max-w-full max-h-full object-contain bg-white rounded-lg shadow-2xl"
                />
              ) : (
                <div className="w-96 h-96 flex items-center justify-center text-white bg-gray-800 rounded-lg">
                  <div className="text-center">
                    <svg
                      className="w-16 h-16 mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ strokeWidth: 2 }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-lg font-bold">No Image</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Token Select Modal */}
      {showTokenSelect && (
        <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4">
          <div
            className="hand-drawn-card w-full max-w-md"
            style={{ transform: "rotate(0.5deg)" }}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-art-gray-900 transform -rotate-1">
                  Select Token
                </h3>
                <button
                  onClick={() => setShowTokenSelect(false)}
                  className="text-art-gray-400 hover:text-art-gray-600 transform rotate-1"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-2">
                {availableTokens.map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => {
                      setSelectedCurrency(token.symbol as "ETH" | "USDC");
                      setShowTokenSelect(false);
                    }}
                    className={`w-full p-3 text-left rounded-art transition-all duration-200 ${
                      selectedCurrency === token.symbol
                        ? "bg-art-gray-900 text-art-white"
                        : "bg-art-gray-100 text-art-gray-700 hover:bg-art-gray-200"
                    }`}
                    style={{
                      borderRadius:
                        selectedCurrency === token.symbol
                          ? "12px 3px 8px 6px"
                          : "8px 12px 6px 10px",
                      transform:
                        selectedCurrency === token.symbol
                          ? "rotate(-1deg)"
                          : "rotate(0.5deg)",
                      border: "2px solid #2d3748",
                      boxShadow:
                        selectedCurrency === token.symbol
                          ? "2px 2px 0 #2d3748"
                          : "1px 1px 0 #2d3748",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold">{token.symbol}</div>
                        <div className="text-xs opacity-75">
                          {token.symbol === "ETH"
                            ? "Ethereum"
                            : token.symbol === "USDC"
                            ? "USD Coin"
                            : "ZORA Token"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{token.balance}</div>
                        <div className="text-xs opacity-75">{token.symbol}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trade Success Modal */}
      <TradeSuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          onClose();
        }}
        tradeType={tradeType}
        amount={amount}
        token={token}
        tokenPrice={data?.tokenPrice?.priceInUsdc}
      />
    </div>
  );
}
