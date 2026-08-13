import React from "react";
import { openFarcasterComposer } from "@/utils/share";

interface CoinShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  tokenImage?: string;
  marketCap?: string;
  price?: string;
  volume24h?: string;
  priceChange24h?: number;
}

export default function CoinShareModal({
  isOpen,
  onClose,
  tokenName,
  tokenSymbol,
  tokenAddress,
  tokenImage,
  marketCap = "0",
  price = "0",
  volume24h = "0",
  priceChange24h = 0,
}: CoinShareModalProps) {
  const getShareText = () => {
    const changeEmoji = priceChange24h >= 0 ? "📈" : "📉";
    const changeSign = priceChange24h >= 0 ? "+" : "";

    return `${changeEmoji} ${tokenName} ($${tokenSymbol})

💰 Price: $${price}
📊 Market Cap: $${marketCap}
📈 24h Volume: $${volume24h}
${changeSign}${priceChange24h.toFixed(2)}% (24h)

Hand-drawn art token on Base! 🎨✨`;
  };

  const handleShareFarcaster = () => {
    try {
      const shareText = getShareText();
      const shareUrl = `https://drawcoin.app/coin/${tokenAddress}`;

      openFarcasterComposer({
        text: shareText,
        embed: shareUrl,
        channelKey: "base",
      });

      onClose();
    } catch (error) {
      console.error("Error sharing to Farcaster:", error);
    }
  };

  const handleShareTwitter = () => {
    try {
      const shareText = getShareText();
      const shareUrl = `https://drawcoin.app/coin/${tokenAddress}`;

      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        shareText
      )}&url=${encodeURIComponent(shareUrl)}&hashtags=DrawCoin,Base,NFT,Art`;
      window.open(twitterUrl, "_blank", "width=550,height=420");

      onClose();
    } catch (error) {
      console.error("Error sharing to Twitter:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="hand-drawn-card max-w-md w-full"
        style={{
          transform: "rotate(-0.5deg)",
          maxWidth: "500px",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 border-b-2 border-art-gray-900"
          style={{ borderStyle: "dashed" }}
        >
          <div className="flex items-center space-x-3">
            <div
              className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center"
              style={{
                transform: "rotate(1deg)",
              }}
            >
              <svg
                className="w-8 h-8 text-blue-600"
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
            </div>
            <div>
              <h2 className="text-xl font-bold text-art-gray-900 transform -rotate-0.5">
                Share Token
              </h2>
              <p className="text-sm text-art-gray-500">Spread the word!</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-art-gray-400 hover:text-art-gray-600 transition-colors transform rotate-1"
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
        <div className="p-6 space-y-4">
          {/* Token Preview */}
          <div
            className="bg-art-gray-50 border border-art-gray-200 rounded-art p-4"
            style={{
              transform: "rotate(-0.3deg)",
              borderRadius: "15px 5px 10px 8px",
            }}
          >
            <div className="flex items-center space-x-4">
              {tokenImage && (
                <img
                  src={tokenImage}
                  alt={tokenName}
                  className="w-16 h-16 rounded-full border-2 border-art-gray-900"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-art-gray-900">
                  {tokenName}
                </h3>
                <p className="text-sm text-art-gray-600 font-mono">
                  ${tokenSymbol}
                </p>
                <div className="mt-2 space-y-1">
                  <div className="text-xs text-art-gray-600">
                    💰 Price: <span className="font-bold">${price}</span>
                  </div>
                  <div className="text-xs text-art-gray-600">
                    📊 MCap: <span className="font-bold">${marketCap}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Share Preview */}
          <div
            className="bg-white border border-art-gray-200 rounded-art p-3"
            style={{
              borderRadius: "10px 5px 8px 6px",
            }}
          >
            <pre className="text-xs text-art-gray-700 whitespace-pre-wrap font-sans">
              {getShareText()}
            </pre>
          </div>

          {/* Share Buttons */}
          <div className="space-y-3">
            {/* Farcaster Share Button */}
            <button
              onClick={handleShareFarcaster}
              className="hand-drawn-btn w-full text-lg py-4"
              style={{
                transform: "rotate(-0.5deg)",
                backgroundColor: "#7c65c1",
              }}
            >
              <div className="flex items-center justify-center">
                Share on Farcaster
              </div>
            </button>

            {/* Twitter Share Button */}
            <button
              onClick={handleShareTwitter}
              className="hand-drawn-btn w-full text-lg py-4"
              style={{
                transform: "rotate(0.5deg)",
                backgroundColor: "#1DA1F2",
              }}
            >
              <div className="flex items-center justify-center">Share on X</div>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="hand-drawn-btn w-full text-sm py-3"
              style={{
                transform: "rotate(0.3deg)",
                backgroundColor: "transparent",
                color: "#4a5568",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
