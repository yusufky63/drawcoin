"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { isAddress } from "viem";
import CoinDetailPage from "../../../components/coin/CoinDetailPage";
import { Coin } from "../../../lib/supabase";
import { getCoinDetails } from "../../../services/sdk/getCoins";

type CoinDetailsResponse = Partial<Coin> & {
  zora20Token?: Partial<Coin>;
};

const TOKEN_REQUEST_TIMEOUT_MS = 10_000;

export default function CoinRoutePage() {
  const params = useParams();
  const router = useRouter();
  const contractAddress =
    typeof params.address === "string" ? params.address : "";

  const [token, setToken] = useState<Coin | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const loadToken = async () => {
      setLoading(true);
      setLoadError(null);
      setToken(null);

      if (!contractAddress || !isAddress(contractAddress)) {
        setLoadError("This token address is invalid.");
        setLoading(false);
        return;
      }

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error("TOKEN_REQUEST_TIMEOUT")),
            TOKEN_REQUEST_TIMEOUT_MS,
          );
        });

        const response = (await Promise.race([
          getCoinDetails(contractAddress),
          timeoutPromise,
        ])) as CoinDetailsResponse | null | undefined;
        const tokenData = response?.zora20Token ?? response;

        if (
          !tokenData ||
          typeof tokenData.name !== "string" ||
          tokenData.name.trim().length === 0 ||
          typeof tokenData.symbol !== "string" ||
          tokenData.symbol.trim().length === 0
        ) {
          throw new Error("TOKEN_NOT_FOUND");
        }

        const loadedToken: Coin = {
          ...tokenData,
          name: tokenData.name.trim(),
          symbol: tokenData.symbol.trim(),
          contract_address: contractAddress,
          image_url:
            tokenData.mediaContent?.previewImage?.small ||
            tokenData.mediaContent?.previewImage?.medium ||
            tokenData.image_url ||
            "",
          creator_address:
            tokenData.creator_address || tokenData.creatorAddress || "",
          chainId: tokenData.chainId || 8453,
        };

        if (!cancelled) {
          setToken(loadedToken);
        }
      } catch (error) {
        if (cancelled) return;

        console.error("Error loading token:", error);
        setLoadError(
          error instanceof Error && error.message === "TOKEN_REQUEST_TIMEOUT"
            ? "The token request timed out. Please try again."
            : "Token data could not be loaded. Please try again.",
        );
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    };

    void loadToken();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [contractAddress, retryKey]);

  const handleBack = () => {
    router.back();
  };

  const retryLoad = () => {
    setLoading(true);
    setRetryKey((current) => current + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-art-gray-50 flex items-center justify-center pb-20 md:pb-0">
        <div className="text-center" role="status" aria-live="polite">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-art-gray-900 mx-auto mb-4"
            aria-hidden="true"
          />
          <p className="text-art-gray-600">Loading token...</p>
          <p className="text-xs text-art-gray-500 mt-2">
            Fetching data from Base...
          </p>
        </div>
      </div>
    );
  }

  if (loadError || !token) {
    return (
      <div className="min-h-screen bg-art-gray-50 flex items-center justify-center px-4 pb-20 md:pb-0">
        <div
          className="hand-drawn-card max-w-md p-6 text-center"
          role="alert"
        >
          <h1 className="text-xl font-bold text-art-gray-900 mb-2">
            Token could not be loaded
          </h1>
          <p className="text-sm text-art-gray-600 mb-5">
            {loadError || "Token data is unavailable."}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button type="button" onClick={retryLoad} className="hand-drawn-btn">
              Try Again
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="hand-drawn-btn-dotted"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-art-gray-50 pb-20 md:pb-0">
      <CoinDetailPage token={token} onBack={handleBack} />
    </div>
  );
}
