import React from "react";
import { sdk as miniAppSdk } from "@farcaster/miniapp-sdk";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioValue?: number;
  totalPnL?: number;
  tokenCount?: number;
  userName?: string;
  userAddress?: string;
}

export default function ShareModal({
  isOpen,
  onClose,
  portfolioValue = 0,
  totalPnL = 0,
  tokenCount = 0,

  userAddress,
}: ShareModalProps) {
  const getShareText = () => {
    const pnlSign = totalPnL >= 0 ? "+" : "";
    const pnlEmoji = totalPnL >= 0 ? "📈" : "📉";

    return `${pnlEmoji} My DrawCoin Portfolio

💰 Total Value: $${portfolioValue.toFixed(2)}
${pnlSign}$${totalPnL.toFixed(2)} PnL
🎨 ${tokenCount} Art Tokens

Trade hand-drawn art tokens on Base! 🚀`;
  };

  const handleShareFarcaster = async () => {
    try {
      const shareText = getShareText();
      const shareUrl = userAddress
        ? `https://drawcoin.app/portfolio?user=${userAddress}`
        : "https://drawcoin.app";

      await miniAppSdk.actions.composeCast({
        text: shareText,
        embeds: [shareUrl],
      });

      onClose();
    } catch (error) {
      console.error("Error sharing to Farcaster:", error);
    }
  };

  const handleShareTwitter = () => {
    try {
      const shareText = getShareText();
      const shareUrl = userAddress
        ? `https://drawcoin.app/portfolio?user=${userAddress}`
        : "https://drawcoin.app";

      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        shareText
      )}&url=${encodeURIComponent(shareUrl)}`;
      window.open(twitterUrl, "_blank");

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
                Share Portfolio
              </h2>
              <p className="text-sm text-art-gray-500">Show off your gains!</p>
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
          {/* Portfolio Stats Preview */}
          <div
            className="bg-art-gray-50 border border-art-gray-200 rounded-art p-4"
            style={{
              transform: "rotate(-0.3deg)",
              borderRadius: "15px 5px 10px 8px",
            }}
          >
            <div className="text-center space-y-2">
              <div className="text-3xl font-bold text-art-gray-900">
                ${portfolioValue.toFixed(2)}
              </div>
              <div
                className={`text-lg font-medium ${
                  totalPnL >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)} PnL
              </div>
              <div className="text-sm text-art-gray-600">
                {tokenCount} Art Token{tokenCount !== 1 ? "s" : ""}
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
