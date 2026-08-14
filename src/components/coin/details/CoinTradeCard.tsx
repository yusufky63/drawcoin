import React from "react";
import { Coin } from "../../../lib/supabase";
import { ZORA_TRADE_EOA_ONLY_MESSAGE } from "../../../lib/zoraTradeSafety";
import {
  amountForPercentage,
  parseTradeAmount,
  percentageForAmount,
} from "../../../lib/tradeAmount";

export type BuyCurrency = "ETH" | "USDC";
const BUY_CURRENCIES = ["ETH", "USDC"] as const;

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
  usdcBalance: string;
  tokenBalance: string;
  handleTrade: () => void;
  loading: boolean;
  isConnected: boolean;
  isTradeWalletSupported: boolean;
  usdValue: number;
  balanceRaw: bigint;
  balanceDecimals: number;
  balanceReserveRaw: bigint;
  buyCurrency: BuyCurrency;
  setBuyCurrency: (currency: BuyCurrency) => void;
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
  usdcBalance,
  tokenBalance,
  handleTrade,
  loading,
  isConnected,
  isTradeWalletSupported,
  usdValue,
  balanceRaw,
  balanceDecimals,
  balanceReserveRaw,
  buyCurrency,
  setBuyCurrency,
}) => {
  const [currencyPickerOpen, setCurrencyPickerOpen] = React.useState(false);
  const currencyButtonRef = React.useRef<HTMLButtonElement>(null);
  const sliderPercentage = percentageForAmount(
    amount,
    balanceDecimals,
    balanceRaw,
    balanceReserveRaw
  );
  const hasValidAmount = parseTradeAmount(amount, balanceDecimals) !== null;
  const setPercentage = (percentage: number) => {
    setAmount(
      amountForPercentage(
        balanceRaw,
        balanceDecimals,
        percentage,
        balanceReserveRaw
      )
    );
  };

  React.useEffect(() => {
    if (!currencyPickerOpen) return;
    const currencyButton = currencyButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCurrencyPickerOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      currencyButton?.focus();
    };
  }, [currencyPickerOpen]);

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
                ? `Your ${buyCurrency}: ${
                    buyCurrency === "ETH" ? ethBalance : usdcBalance
                  } ${buyCurrency}`
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
            {tradeType === "buy" && (
              <button
                ref={currencyButtonRef}
                type="button"
                onClick={() => setCurrencyPickerOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={currencyPickerOpen}
                className="inline-flex min-w-[6.75rem] shrink-0 items-center justify-between gap-2 rounded-[9px_4px_8px_5px] border-2 border-art-gray-900 bg-white px-3 py-2 text-sm font-bold text-art-gray-900 shadow-[2px_2px_0_#2d3748] transition-transform hover:-translate-y-0.5"
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black text-white ${
                      buyCurrency === "ETH" ? "bg-[#343434]" : "bg-[#2775ca]"
                    }`}
                  >
                    {buyCurrency === "ETH" ? "◆" : "$"}
                  </span>
                  {buyCurrency}
                </span>
                <span aria-hidden="true" className="text-xs text-art-gray-500">
                  ▾
                </span>
              </button>
            )}
          </div>
          {tradeType === "buy" && (
            <p className="mt-2 text-xs font-medium text-art-gray-600">
              Buy with ETH or USDC on Base.
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
            value={sliderPercentage}
            onChange={(e) => setPercentage(Number(e.target.value))}
            className="hand-drawn-input w-full h-3"
            style={{
              background: (() => {
                if (!hasValidAmount || balanceRaw === BigInt(0))
                  return "linear-gradient(to right, #e2e8f0 0%, #e2e8f0 100%)";
                return `linear-gradient(to right, var(--base-blue) 0%, var(--base-blue) ${sliderPercentage}%, #e2e8f0 ${sliderPercentage}%, #e2e8f0 100%)`;
              })(),
            }}
          />
          <div className="flex justify-between text-xs text-art-gray-500 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>{tradeType === "sell" ? "Max" : "100%"}</span>
          </div>
        </div>

        {/* Quick Percentage Buttons */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-art-gray-600 mb-2 transform -rotate-0.5">
            Quick Amount
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map((percentage, index) => (
              <button
                key={percentage}
                type="button"
                onClick={() => setPercentage(percentage)}
                aria-label={
                  percentage === 100 && tradeType === "sell"
                    ? "Use safe maximum sell amount"
                    : `Use ${percentage}% of available balance`
                }
                title={
                  percentage === 100 && tradeType === "sell"
                    ? "Uses 98% of the token balance for quote reliability"
                    : undefined
                }
                className="hand-drawn-btn text-xs font-bold"
                style={{
                  padding: "0.5rem 0.75rem",
                  transform: `rotate(${index % 2 === 0 ? "1deg" : "-1deg"})`,
                }}
              >
                {percentage === 100 && tradeType === "sell"
                  ? "Max"
                  : `${percentage}%`}
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
              {amount}{" "}
              {tradeType === "buy" ? buyCurrency : token.symbol}
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
              !hasValidAmount ||
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

      {currencyPickerOpen && tradeType === "buy" ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setCurrencyPickerOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="buy-currency-title"
            className="hand-drawn-card w-full max-w-sm p-4 sm:p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3
                  id="buy-currency-title"
                  className="text-lg font-bold text-art-gray-900"
                >
                  Pay with
                </h3>
                <p className="text-xs font-medium text-art-gray-500">
                  Choose a Base asset
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCurrencyPickerOpen(false)}
                aria-label="Close currency picker"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-art-gray-900 bg-white text-xl font-bold shadow-[2px_2px_0_#2d3748]"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              {BUY_CURRENCIES.map((symbol) =>
                symbol === "ETH"
                  ? {
                      symbol,
                      name: "Ethereum",
                      balance: ethBalance,
                      icon: "◆",
                      iconClass: "bg-[#343434]",
                    }
                  : {
                      symbol,
                      name: "USD Coin",
                      balance: usdcBalance,
                      icon: "$",
                      iconClass: "bg-[#2775ca]",
                    }
              ).map((currency, index) => (
                <button
                  key={currency.symbol}
                  type="button"
                  autoFocus={index === 0}
                  onClick={() => {
                    setBuyCurrency(currency.symbol);
                    setCurrencyPickerOpen(false);
                  }}
                  aria-pressed={buyCurrency === currency.symbol}
                  className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-[12px_5px_10px_7px] border-2 border-art-gray-900 px-3 py-3 text-left shadow-[2px_2px_0_#2d3748] transition-colors ${
                    buyCurrency === currency.symbol
                      ? "bg-[var(--base-blue)] text-white"
                      : "bg-white text-art-gray-900 hover:bg-art-gray-50"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white ${currency.iconClass}`}
                    >
                      {currency.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold">{currency.symbol}</span>
                      <span
                        className={`block text-xs ${
                          buyCurrency === currency.symbol
                            ? "text-blue-100"
                            : "text-art-gray-500"
                        }`}
                      >
                        {currency.name}
                      </span>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-mono text-sm font-bold">
                      {currency.balance}
                    </span>
                    <span
                      className={`block text-xs ${
                        buyCurrency === currency.symbol
                          ? "text-blue-100"
                          : "text-art-gray-500"
                      }`}
                    >
                      Balance
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
};
