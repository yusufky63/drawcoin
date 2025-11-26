import React from "react";
import { Coin } from "../../../lib/supabase";

interface CoinTradeCardProps {
  token: Coin;
  tradeType: "buy" | "sell";
  setTradeType: (type: "buy" | "sell") => void;
  amount: string;
  setAmount: (amount: string) => void;
  slippage: number;
  setSlippage: (slippage: number) => void;
  showSlippageSettings: boolean;
  setShowSlippageSettings: (show: boolean) => void;
  ethBalance: string;
  tokenBalance: string;
  usdcBalance: string;
  selectedCurrency: "ETH" | "USDC";
  setSelectedCurrency: (currency: "ETH" | "USDC") => void;
  showTokenSelect: boolean;
  setShowTokenSelect: (show: boolean) => void;
  availableTokens: Array<{ symbol: string; address: string; balance: string }>;
  handleTrade: () => void;
  loading: boolean;
  isConnected: boolean;
  isCreator: boolean;
  usdValue: number;
  maxBalance: number;
}

export const CoinTradeCard: React.FC<CoinTradeCardProps> = ({
  token,
  tradeType,
  setTradeType,
  amount,
  setAmount,
  slippage,
  setSlippage,
  showSlippageSettings,
  setShowSlippageSettings,
  ethBalance,
  tokenBalance,
  usdcBalance,
  selectedCurrency,
  setSelectedCurrency,
  showTokenSelect,
  setShowTokenSelect,
  availableTokens,
  handleTrade,
  loading,
  isConnected,
  isCreator,
  usdValue,
  maxBalance,
}) => {
  return (
    <div>
      <div className="">
        {/* Trade Type Toggle */}
        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => setTradeType("buy")}
            className={`flex-1 text-sm font-bold ${
              tradeType === "buy"
                ? "hand-drawn-btn secondary"
                : "hand-drawn-btn-dotted"
            }`}
            style={{
              transform:
                tradeType === "buy" ? "rotate(-1deg)" : "rotate(0.5deg)",
            }}
          >
            Buy
          </button>
          <button
            onClick={() => setTradeType("sell")}
            className={`flex-1 text-sm font-bold ${
              tradeType === "sell"
                ? "hand-drawn-btn danger"
                : "hand-drawn-btn-dotted"
            }`}
            style={{
              transform:
                tradeType === "sell" ? "rotate(1deg)" : "rotate(-0.5deg)",
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
              onClick={() => setShowSlippageSettings(!showSlippageSettings)}
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
                    max="50"
                    step="0.1"
                    value={slippage * 100}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= 0.1 && value <= 50) {
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
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Amount Input with Currency Selection */}
        <div className="mb-4">
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
              placeholder="0.0"
              className="hand-drawn-input flex-1 p-2 font-mono text-lg"
            />
            {/* Currency Selection */}
            {tradeType === "buy" && (
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowTokenSelect(true)}
                  className="hand-drawn-btn text-sm font-bold py-2 px-3 transform rotate-1"
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "8px 3px 6px 4px",
                    minWidth: "80px",
                  }}
                >
                  {selectedCurrency}
                </button>

                {/* Visual Cue for USDC */}
                {selectedCurrency === "ETH" && (
                  <div className="absolute top-full -right-6 mt-2 md:-right-20 md:mt-4 pointer-events-none z-20">
                    <div className="relative flex flex-col items-end">
                      <svg
                        width="80"
                        height="60"
                        viewBox="0 0 80 60"
                        className="absolute -top-8 right-4 w-16 h-12 md:-top-12 md:right-12 md:w-20 md:h-16 text-[#4299e1] transform -rotate-12"
                        style={{
                          filter: "drop-shadow(1px 1px 0px rgba(0,0,0,0.1))",
                        }}
                      >
                        <path
                          d="M 70 50 Q 40 40 10 10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeDasharray="80"
                          className="animate-[dash_1s_ease-out_forwards]"
                        />
                        <path
                          d="M 10 10 L 25 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M 10 10 L 12 25"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span
                        style={{ fontFamily: "'Kalam', cursive" }}
                        className="relative block text-[#4299e1] font-bold text-xs md:text-sm transform -rotate-6 bg-white/90 px-2 py-0.5 md:px-3 md:py-1 rounded-lg border-2 border-indigo-200 shadow-sm whitespace-nowrap mt-4 md:mt-0"
                      >
                        Select USDC!
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {amount && (
            <div className="mt-1 text-xs text-art-gray-500">
              ≈ ${usdValue?.toFixed(2) || "0.00"} USD
            </div>
          )}
        </div>

        {/* Amount Slider */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-art-gray-600 mb-2 transform rotate-0.5">
            Amount Slider
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={(() => {
              if (!amount || !maxBalance) return 0;
              return (parseFloat(amount) / maxBalance) * 100;
            })()}
            onChange={(e) => {
              const percentage = parseFloat(e.target.value) / 100;

              // Apply safety buffer
              let safetyFactor = percentage;
              if (tradeType === "sell") {
                // For sell, maxBalance already includes creator restrictions
                safetyFactor = percentage === 1 ? 0.999 : percentage;
              } else {
                // For buy, use standard safety buffer
                safetyFactor = percentage === 1 ? 0.999 : percentage;
              }

              const newAmount = (maxBalance * safetyFactor).toFixed(4);
              setAmount(newAmount);
            }}
            className="hand-drawn-input w-full h-3"
            style={{
              background: (() => {
                if (!amount || !maxBalance)
                  return "linear-gradient(to right, #e2e8f0 0%, #e2e8f0 100%)";
                const percentage = (parseFloat(amount) / maxBalance) * 100;
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
        <div className="mb-4">
          <label className="block text-sm font-bold text-art-gray-600 mb-2 transform -rotate-0.5">
            Quick Amount
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[0.25, 0.5, 0.75, 1].map((p, index) => (
              <button
                key={p}
                onClick={() => {
                  // Apply safety buffer based on user type and percentage
                  let safetyFactor = p;

                  if (tradeType === "sell") {
                    if (isCreator) {
                      // Creator: already has 10M reserve + 0.5% buffer in maxBalance
                      safetyFactor = p === 1 ? 0.999 : p;
                    } else {
                      // Regular user: use 99.9% for 100%
                      safetyFactor = p === 1 ? 0.999 : p;
                    }
                  } else {
                    // Buy: use 99.9% for 100%
                    safetyFactor = p === 1 ? 0.999 : p;
                  }

                  const newAmount = (maxBalance * safetyFactor).toFixed(4);
                  setAmount(newAmount);
                }}
                className="hand-drawn-btn text-xs font-bold"
                style={{
                  padding: "0.5rem 0.75rem",
                  transform: `rotate(${index % 2 === 0 ? "1deg" : "-1deg"})`,
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
                  {(() => {
                    const totalBalance = parseFloat(tokenBalance);
                    const CREATOR_RESERVED = 10_000_000;
                    const availableTokens = Math.max(
                      0,
                      totalBalance - CREATOR_RESERVED
                    );
                    const safeAmount = Math.floor(availableTokens * 0.995);

                    return (
                      <>
                        Available to sell:{" "}
                        <strong>{safeAmount.toLocaleString()}</strong> tokens
                        <br />
                        <span className="text-yellow-500">
                          (10M tokens reserved + 0.5% safety buffer)
                        </span>
                      </>
                    );
                  })()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Trade Summary */}
        {amount && (
          <div
            className="bg-art-gray-50 p-2 rounded-art transform rotate-0.3 mb-4"
            style={{ borderRadius: "8px 6px 10px 4px" }}
          >
            <div className="text-xs text-art-gray-600">
              {tradeType === "buy" ? "Buy" : "Sell"}{" "}
              {parseFloat(amount).toFixed(4)}{" "}
              {tradeType === "buy" ? "ETH" : token.symbol}
              <span className="text-art-gray-500 ml-2">
                ≈ ${usdValue?.toFixed(2) || "0.00"} USD
              </span>
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
                {selectedCurrency} trading may require 2 transactions: approval
                + trade
              </p>
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

        {/* Trade Button */}
        <div className="pt-2">
          <button
            onClick={handleTrade}
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className={`w-full hand-drawn-btn text-sm font-bold py-3 disabled:opacity-50 disabled:cursor-not-allowed ${
              tradeType === "buy" ? "secondary" : "danger"
            }`}
            style={{
              padding: "0.75rem 1rem",
              transform: "rotate(-0.5deg)",
            }}
          >
            {loading
              ? "Processing..."
              : `${tradeType === "buy" ? "Buy" : "Sell"} ${token.symbol}`}
          </button>
        </div>
      </div>

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
    </div>
  );
};
