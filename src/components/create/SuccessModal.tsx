import React, { useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import HandDrawnIcon from "../ui/HandDrawnIcon";
import { openFarcasterComposer } from "@/utils/share";
import type { CoinRecordStatus } from "@/lib/functions/createToken";

const DIALOG_FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  tokenImage?: string;
  transactionHash?: string;
  recordStatus?: CoinRecordStatus;
  recordError?: string | null;
  onRetrySync?: () => void;
  isRetryingSync?: boolean;
}

export default function SuccessModal({
  isOpen,
  onClose,
  tokenName,
  tokenSymbol,
  tokenAddress,
  tokenImage,
  transactionHash,
  recordStatus = "recorded",
  recordError,
  onRetrySync,
  isRetryingSync = false,
}: SuccessModalProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const isRecorded = recordStatus === "recorded";

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          DIALOG_FOCUSABLE_SELECTOR
        )
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const frameId = window.requestAnimationFrame(() => {
      const primaryAction = primaryActionRef.current;
      if (primaryAction && !primaryAction.disabled) {
        primaryAction.focus();
        return;
      }

      dialogRef.current
        ?.querySelector<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR)
        ?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen, isRecorded]);

  const handleViewToken = () => {
    if (!tokenAddress) return;
    router.push(`/coin/${tokenAddress}`);
  };

  const handleShareFarcaster = () => {
    try {
      const shareText = `🎨✨ Just created my hand-drawn art token "${tokenName}" (${tokenSymbol}) on DrawCoin! Check out my artwork and trade it on Base! 🚀`;

      openFarcasterComposer({
        text: shareText,
        embed: `https://drawcoin.app/coin/${tokenAddress}`,
        channelKey: "base",
      });
    } catch (error) {
      console.error("Error sharing to Farcaster:", error);
    }
  };

  const handleShareTwitter = () => {
    try {
      const shareText = `🎨✨ Just created my hand-drawn art token "${tokenName}" (${tokenSymbol}) on DrawCoin! Check out my artwork and trade it on Base! 🚀`;
      const shareUrl = `https://drawcoin.app/coin/${tokenAddress}`;

      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        shareText
      )}&url=${encodeURIComponent(shareUrl)}&hashtags=DrawCoin,Base,NFT,Art`;
      window.open(twitterUrl, "_blank", "width=550,height=420");
    } catch (error) {
      console.error("Error sharing to Twitter:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="creation-result-title"
        aria-describedby="creation-result-description"
        className="hand-drawn-card max-h-[calc(100dvh-2rem)] max-w-md w-full overflow-y-auto"
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
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isRecorded ? "bg-green-100" : "bg-amber-100"
              }`}
              style={{
                transform: "rotate(1deg)",
              }}
            >
              <svg
                className={`w-8 h-8 ${
                  isRecorded ? "text-green-600" : "text-amber-700"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isRecorded ? "M5 13l4 4L19 7" : "M12 9v4m0 4h.01"}
                />
              </svg>
            </div>
            <div>
              <h2
                id="creation-result-title"
                className="text-xl font-bold text-art-gray-900 transform -rotate-0.5"
              >
                {isRecorded ? "Token Created!" : "Created on Base"}
              </h2>
              <p
                id="creation-result-description"
                className="text-sm text-art-gray-500"
              >
                {isRecorded
                  ? "Your artwork is live in DrawCoin"
                  : "One final Explore sync is still needed"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close creation result"
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
        <div className="p-6 space-y-6">
          {/* Token Preview */}
          <div className="text-center">
            <div
              className="w-24 h-24 mx-auto mb-4 bg-art-gray-50 overflow-hidden"
              style={{
                border: "3px solid #2d3748",
                borderRadius: "20px 8px 15px 12px",
                transform: "rotate(0.5deg)",
              }}
            >
              {tokenImage ? (
                <Image
                  src={tokenImage}
                  alt={tokenName}
                  width={96}
                  height={96}
                  unoptimized
                  className="w-full h-full object-contain bg-white"
                  style={{ borderRadius: "17px 5px 12px 9px" }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-art-gray-400">
                  <HandDrawnIcon type="art" />
                </div>
              )}
            </div>
            <h3 className="text-lg font-bold text-art-gray-900 mb-1">
              {tokenName}
            </h3>
            <p className="text-sm text-art-gray-500 font-mono bg-art-gray-100 px-3 py-1 rounded-art transform rotate-1 inline-block">
              {tokenSymbol}
            </p>
          </div>

          {/* Success Message */}
          <div
            className={`rounded-art border p-4 ${
              isRecorded
                ? "border-green-200 bg-green-50"
                : "border-amber-300 bg-amber-50"
            }`}
            style={{
              transform: "rotate(-0.3deg)",
              borderRadius: "15px 5px 10px 8px",
            }}
          >
            <div className="flex items-center">
              <svg
                className={`w-5 h-5 mr-3 ${
                  isRecorded ? "text-green-600" : "text-amber-700"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={
                    isRecorded
                      ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      : "M12 8v4m0 4h.01M4.93 19h14.14a2 2 0 001.73-3L13.73 4a2 2 0 00-3.46 0L3.2 16A2 2 0 004.93 19z"
                  }
                />
              </svg>
              <div>
                <p
                  className={`text-sm font-medium ${
                    isRecorded ? "text-green-800" : "text-amber-950"
                  }`}
                >
                  {isRecorded
                    ? "Your art token is created and synced."
                    : "Your token exists on Base; it has not been added to Explore yet."}
                </p>
                <p
                  className={`text-xs mt-1 ${
                    isRecorded ? "text-green-600" : "text-amber-800"
                  }`}
                >
                  {isRecorded
                    ? "It is ready to view, share, and trade."
                    : recordError ??
                      "Retrying the sync never sends a second mint transaction."}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {isRecorded ? (
              <>
                <button
                  ref={primaryActionRef}
                  type="button"
                  onClick={handleViewToken}
                  disabled={!tokenAddress}
                  className="hand-drawn-btn w-full text-lg py-4 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    transform: "rotate(-0.5deg)",
                  }}
                >
                  View Your Token
                </button>
                <button
                  type="button"
                  onClick={handleShareFarcaster}
                  className="hand-drawn-btn w-full text-lg py-4"
                  style={{
                    transform: "rotate(0.5deg)",
                    backgroundColor: "#7c65c1",
                  }}
                >
                  Share on Farcaster
                </button>
                <button
                  type="button"
                  onClick={handleShareTwitter}
                  className="hand-drawn-btn w-full text-lg py-4 secondary"
                  style={{
                    transform: "rotate(-0.5deg)",
                    backgroundColor: "#1DA1F2",
                  }}
                >
                  Share on X
                </button>
              </>
            ) : (
              <>
                <button
                  ref={primaryActionRef}
                  type="button"
                  onClick={onRetrySync}
                  disabled={!onRetrySync || isRetryingSync}
                  className="hand-drawn-btn w-full py-4 text-base disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRetryingSync ? "Syncing to Explore…" : "Sync to Explore"}
                </button>
                {transactionHash && (
                  <a
                    href={`https://basescan.org/tx/${transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-art border-2 border-art-gray-900 bg-white px-4 text-sm font-bold text-art-gray-900 hover:bg-art-gray-100"
                  >
                    View confirmed Base transaction
                  </a>
                )}
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="hand-drawn-btn w-full text-lg py-4 secondary danger"
              style={{
                transform: "rotate(-0.3deg)",
              }}
            >
              <div className="flex items-center justify-center">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                {isRecorded ? "Close" : "Finish later"}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
