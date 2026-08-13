import React from "react";
import { Coin } from "../../../lib/supabase";
import { ZORA_TRADE_EOA_ONLY_MESSAGE } from "../../../lib/zoraTradeSafety";

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
  handleTrade: () => void;
  loading: boolean;
  isConnected: boolean;
  isTradeWalletSupported: boolean;
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
  handleTrade,
  loading,
  isConnected,
  isTradeWalletSupported,
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
                  {[0.005, 0.01, 0.03, 0.05, 0.1].map((value) => (
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
                    max="10"
                    step="0.1"
                    value={slippage * 100}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= 0.1 && value <= 10) {
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

        {/* Amount Input */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-bold text-art-gray-600 transform -rotate-0.5">
              Amount
            </label>
            <div className="text-xs text-art-gray-500">
              {tradeType === "buy"
                ? `Your ETH: ${ethBalance} ETH`
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
            {/* This trade path currently settles buys with native ETH only. */}
            {tradeType === "buy" && (
              <span
                className="hand-drawn-btn text-sm font-bold py-2 px-3 flex-shrink-0 cursor-default"
                aria-label="Buy currency: ETH only"
              >
                ETH
              </span>
            )}
          </div>
          {tradeType === "buy" && (
            <p className="mt-2 text-xs font-medium text-art-gray-600">
              Buys currently use ETH on Base.
            </p>
          )}
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
              const safetyFactor = percentage === 1 ? 0.999 : percentage;

              const newAmount = (maxBalance * safetyFactor).toFixed(4);
              setAmount(newAmount);
            }}
            className="hand-drawn-input w-full h-3"
            style={{
              background: (() => {
                if (!amount || !maxBalance)
                  return "linear-gradient(to right, #e2e8f0 0%, #e2e8f0 100%)";
                const percentage = (parseFloat(amount) / maxBalance) * 100;
                return `linear-gradient(to right, var(--base-blue) 0%, var(--base-blue) ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`;
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
                  const safetyFactor = p === 1 ? 0.999 : p;

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

        {isConnected && !isTradeWalletSupported && (
          <div className="mb-4 rounded-art border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            {ZORA_TRADE_EOA_ONLY_MESSAGE}
          </div>
        )}

        {/* Trade Button */}
        <div className="pt-2">
          <button
            onClick={handleTrade}
            disabled={
              loading ||
              !amount ||
              parseFloat(amount) <= 0 ||
              !isTradeWalletSupported
            }
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
              : isConnected && !isTradeWalletSupported
                ? "Use an EOA Wallet"
              : `${tradeType === "buy" ? "Buy" : "Sell"} ${token.symbol}`}
          </button>
        </div>
      </div>

    </div>
  );
};
