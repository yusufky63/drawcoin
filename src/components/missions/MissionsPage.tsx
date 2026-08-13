"use client";

import { useCallback, useMemo, useState } from "react";
import { waitForCallsStatus } from "@wagmi/core";
import { Wallet } from "lucide-react";
import useSWR from "swr";
import {
  useAccount,
  useConfig,
  useConnect,
  useSendCalls,
  useSwitchChain,
} from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { isAddressEqual, type Address, type Hex } from "viem";

import { getMissionClaimAction } from "@/lib/missions/claimUi";
import type {
  MissionCatalog,
  MissionCatalogItem,
  MissionMetric,
  MissionProgress,
  MissionSnapshot,
} from "@/lib/missions/types";

type ClaimVoucherResponse = {
  claim: {
    account: Address;
    to: Address;
    data: Hex;
    value: Hex;
    chainId: number;
  };
  paymaster:
    | { enabled: true; url: string }
    | { enabled: false; reason: string };
};

type ApiError = { error?: string; detail?: string };

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    signal: AbortSignal.timeout(8_000),
  });
  const body = (await response.json()) as T & ApiError;

  if (!response.ok) {
    throw new Error(body.detail || body.error || "Request failed.");
  }

  return body;
};

const missionGlyphs: Record<string, string> = {
  "first-stroke": "✦",
  collector: "◇",
  curator: "♡",
  "creator-journey": "✎",
  "ecosystem-builder": "↔",
  "base-regular": "◷",
};

const missionGoalLabels: Record<MissionMetric, string> = {
  verified_creation: "created token",
  verified_buy: "collected token",
  watchlist_token: "saved token",
  ecosystem_role: "community role",
  verified_activity_day: "active day",
};

const missionDescriptions: Record<string, string> = {
  "first-stroke": "Create your first DrawCoin on Base.",
  collector: "Collect your first DrawCoin on Base.",
  curator: "Save five DrawCoins to your watchlist.",
  "creator-journey": "Create three DrawCoins on Base.",
  "ecosystem-builder": "Create a DrawCoin, then collect one.",
  "base-regular": "Take part on three different days.",
};

function MissionCard({
  mission,
  isClaiming,
  claimingConfigured,
  onClaim,
}: {
  mission: MissionProgress | MissionCatalogItem;
  isClaiming: boolean;
  claimingConfigured: boolean | null;
  onClaim?: (mission: MissionProgress) => void;
}) {
  const progressMission = "progress" in mission ? mission : null;
  const progress = progressMission
    ? Math.min(progressMission.progress, mission.threshold)
    : 0;
  const percentage = Math.min(
    100,
    Math.round((progress / mission.threshold) * 100)
  );
  const isArchived = mission.isActive === false;
  const hasDeployableMetadata = Boolean(
    Number.isSafeInteger(mission.badge.tokenId) &&
      mission.badge.tokenId >= 0 &&
      mission.badge.name.trim() &&
      mission.badge.description.trim() &&
      mission.badge.imageUrl?.trim()
  );
  const claimAction = progressMission
    ? getMissionClaimAction({
        isCompleted: progressMission.isCompleted,
        claimStatus: progressMission.badge.claimStatus,
        isSubmitting: isClaiming,
        hasDeployableMetadata,
        contractConfigured: claimingConfigured,
      })
    : null;
  const statusLabel = isArchived
    ? "Archived"
    : !progressMission
      ? null
      : claimAction?.state === "claimed"
        ? "Claimed"
        : claimAction?.state === "pending"
          ? "Confirming"
          : claimAction?.state === "submitting"
            ? "Claim pending"
            : claimAction?.state === "claimable"
              ? "Ready to claim"
              : claimAction?.state === "unavailable"
                ? "Completed"
                : "In progress";
  const statusTone =
    claimAction?.state === "claimed"
      ? "bg-green-100 text-green-700"
      : claimAction?.state === "claimable"
        ? "bg-[#ffd166] text-art-gray-900"
        : claimAction?.state === "pending" || claimAction?.state === "submitting"
          ? "bg-blue-100 text-blue-700"
          : claimAction?.state === "unavailable"
            ? "bg-green-100 text-green-700"
            : isArchived
              ? "bg-amber-100 text-amber-800"
              : "bg-art-gray-100 text-art-gray-600";

  return (
    <article
      className="hand-drawn-card !mb-0 flex h-full flex-col overflow-hidden bg-white"
      aria-labelledby={`mission-${mission.slug}`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center text-xl font-bold sm:h-12 sm:w-12 sm:text-2xl ${
              progressMission?.isCompleted
                ? "bg-blue-600 text-white"
                : "bg-art-gray-100 text-art-gray-500"
            }`}
            style={{
              border: "2px solid #2d3748",
              borderRadius: "12px 5px 10px 4px",
              boxShadow: "2px 2px 0 #2d3748",
              transform: "rotate(-2deg)",
            }}
            aria-hidden="true"
          >
            {missionGlyphs[mission.slug] || "•"}
          </div>
          <div className="min-w-0">
            <p className="hidden text-xs font-bold uppercase tracking-[0.16em] text-blue-600 sm:block">
              Badge #{mission.badge.tokenId}
            </p>
            <h2
              id={`mission-${mission.slug}`}
              className="truncate text-lg font-bold text-art-gray-900 sm:text-xl"
            >
              {mission.title}
            </h2>
          </div>
        </div>
        {statusLabel ? (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusTone}`}
          >
            {statusLabel}
          </span>
        ) : null}
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-5 text-art-gray-600 sm:mt-4 sm:min-h-12 sm:line-clamp-none sm:leading-6">
        {missionDescriptions[mission.slug] ?? mission.description}
      </p>

      {progressMission ? (
        <div className="mt-4 sm:mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-art-gray-600">
            <span>Progress</span>
            <span>
              {progress} / {mission.threshold}
            </span>
          </div>
          <div
            className="h-3 overflow-hidden bg-art-gray-100"
            style={{
              border: "2px solid #2d3748",
              borderRadius: "8px 3px 7px 4px",
            }}
            role="progressbar"
            aria-label={`${mission.title} progress`}
            aria-valuemin={0}
            aria-valuemax={mission.threshold}
            aria-valuenow={progress}
          >
            <div
              className={`h-full transition-[width] duration-500 ${
                progressMission.isCompleted ? "bg-green-500" : "bg-blue-500"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {progressMission.legacyProgress > 0 ? (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              {progressMission.legacyProgress} older item
              {progressMission.legacyProgress === 1 ? "" : "s"} waiting for
              confirmation
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-800 sm:mt-5">
          <span>Goal</span>
          <span>
            {mission.threshold} {missionGoalLabels[mission.metric]}
            {mission.threshold === 1 ? "" : "s"}
          </span>
        </div>
      )}

      <div className="mt-auto pt-4 sm:pt-5">
        {isArchived ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-center text-xs font-semibold text-amber-800">
            This mission is paused.
          </div>
        ) : progressMission && claimAction?.state === "claimable" ? (
          <button
            type="button"
            onClick={() => onClaim?.(progressMission)}
            className="hand-drawn-btn w-full px-4 py-2.5 text-sm font-bold"
          >
            {claimAction.label}
          </button>
        ) : progressMission && claimAction?.state === "claimed" ? (
          <div className="rounded-lg bg-green-50 px-3 py-2.5 text-center text-xs font-bold text-green-700">
            Badge claimed
          </div>
        ) : progressMission &&
          (claimAction?.state === "pending" ||
            claimAction?.state === "submitting") ? (
          <div className="rounded-lg bg-blue-50 px-3 py-2.5 text-center text-xs font-bold text-blue-700">
            {claimAction.message}
          </div>
        ) : progressMission &&
          claimAction?.state === "unavailable" ? (
          <div className="rounded-lg bg-art-gray-50 px-3 py-2.5 text-center text-xs font-semibold text-art-gray-600">
            {claimAction.message}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function MissionsPage() {
  const { address, chainId, isConnected } = useAccount();
  const wagmiConfig = useConfig();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { sendCallsAsync } = useSendCalls();
  const { switchChainAsync } = useSwitchChain();
  const [claimingSlug, setClaimingSlug] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const hasConnectedWallet = isConnected && Boolean(address);
  const {
    data: catalog,
    error: catalogError,
    isLoading: catalogLoading,
  } = useSWR<MissionCatalog>(
    "/api/missions/catalog",
    fetchJson,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: true,
      errorRetryCount: 1,
      errorRetryInterval: 2_000,
    }
  );
  const {
    data: snapshot,
    error: missionsError,
    isLoading: missionsLoading,
    mutate: refreshMissions,
  } = useSWR<MissionSnapshot>(
    hasConnectedWallet && address
      ? `/api/missions?address=${encodeURIComponent(address)}`
      : null,
    fetchJson,
    {
      revalidateOnFocus: true,
      errorRetryCount: 1,
      errorRetryInterval: 2_000,
    }
  );
  const handleClaim = useCallback(
    async (mission: MissionProgress) => {
      if (!address || claimingSlug) return;

      setClaimingSlug(mission.slug);
      setActionError(null);
      setActionNotice(null);
      let confirmedByStatusRoute = false;

      try {
        const voucherResponse = await fetch("/api/badges/claim-voucher", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, missionSlug: mission.slug }),
        });
        const voucher = (await voucherResponse.json()) as
          | ClaimVoucherResponse
          | ApiError;

        if (!voucherResponse.ok || !("claim" in voucher)) {
          const apiError = voucher as ApiError;
          throw new Error(
            apiError.detail ||
              apiError.error ||
              "Badge claiming is not available yet."
          );
        }
        if (!isAddressEqual(voucher.claim.account, address)) {
          throw new Error("The badge claim was prepared for a different wallet.");
        }
        if (
          voucher.claim.chainId !== base.id &&
          voucher.claim.chainId !== baseSepolia.id
        ) {
          throw new Error("This badge is configured for a different Base network.");
        }
        const badgeChainId = voucher.claim.chainId;

        if (chainId !== badgeChainId) {
          await switchChainAsync({ chainId: badgeChainId });
        }

        const callResult = await sendCallsAsync({
          account: address,
          chainId: badgeChainId,
          calls: [
            {
              to: voucher.claim.to,
              data: voucher.claim.data,
              value: BigInt(voucher.claim.value),
            },
          ],
          capabilities: voucher.paymaster.enabled
            ? {
                paymasterService: {
                  url: voucher.paymaster.url,
                  optional: true,
                },
              }
            : undefined,
          // Unsupported account models and any fail-closed Paymaster rejection
          // continue through the normal user-paid wallet flow.
          experimental_fallback: true,
        });
        const callStatus = await waitForCallsStatus(wagmiConfig, {
          id: callResult.id,
          pollingInterval: 1_500,
          throwOnFailure: true,
          timeout: 90_000,
        });
        const transactionHash = callStatus.receipts?.[0]?.transactionHash;

        if (!transactionHash) {
          throw new Error("The wallet did not return a badge transaction hash.");
        }

        const confirmationResponse = await fetch("/api/badges/status", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            missionSlug: mission.slug,
            transactionHash,
          }),
        });
        const confirmation = (await confirmationResponse.json()) as ApiError & {
          confirmed?: boolean;
          pending?: boolean;
        };

        if (confirmationResponse.status === 202 && confirmation.pending) {
          setActionNotice(
            `${mission.badge.name} was sent and is confirming on Base.`
          );
          return;
        }

        if (!confirmationResponse.ok || !confirmation.confirmed) {
          throw new Error(
            confirmation.error || "The badge claim could not be confirmed."
          );
        }

        confirmedByStatusRoute = true;
        setActionNotice(`${mission.badge.name} was claimed on Base.`);
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Badge claim failed."
        );
      } finally {
        try {
          const refreshedSnapshot = await refreshMissions();
          const reconciledMission = refreshedSnapshot?.missions.find(
            (candidate) => candidate.slug === mission.slug
          );

          if (reconciledMission?.badge.claimStatus === "claimed") {
            setActionError(null);
            if (!confirmedByStatusRoute) {
              setActionNotice(
                `${mission.badge.name} was confirmed from Base contract state.`
              );
            }
          }
        } catch {
          // Keep the original claim outcome visible. Focus/reload will retry the
          // canonical reconciliation without asking the user to claim again.
        }
        setClaimingSlug(null);
      }
    },
    [
      address,
      chainId,
      claimingSlug,
      refreshMissions,
      sendCallsAsync,
      switchChainAsync,
      wagmiConfig,
    ]
  );

  const visibleMissions = useMemo(() => {
    if (!catalog) return snapshot?.missions;

    const progressByMissionId = new Map(
      snapshot?.missions.map((mission) => [mission.id, mission]) ?? []
    );
    return catalog.missions.map(
      (catalogMission) =>
        progressByMissionId.get(catalogMission.id) ?? catalogMission
    );
  }, [catalog, snapshot]);
  const missionContentLoading =
    !visibleMissions &&
    (catalogLoading || (hasConnectedWallet && missionsLoading));
  const missionContentError = !visibleMissions && catalogError;
  const claimingConfigured = catalog
    ? catalog.claiming.configured
    : null;
  const completedMissionCount =
    snapshot?.missions.filter((mission) => mission.isCompleted).length ?? 0;
  const missionCount = visibleMissions?.length ?? 0;

  return (
    <div className="min-h-screen bg-art-gray-50 pb-28 md:pb-14">
      <section className="mx-auto max-w-7xl px-4 py-5 md:py-12">
        <div
          className="overflow-hidden bg-white p-4 sm:p-6 md:p-7"
          style={{
            border: "3px solid #2d3748",
            borderRadius: "24px 9px 20px 11px",
            boxShadow: "6px 6px 0 #2d3748",
            transform: "rotate(-0.15deg)",
          }}
        >
          <div>
            <h1 className="text-2xl font-bold text-art-gray-900 sm:text-3xl md:text-5xl">
              Draw Missions
            </h1>
            <p className="mt-2 text-sm font-medium text-art-gray-600 md:text-base">
              Complete missions and collect badges.
            </p>
          </div>
        </div>

        {hasConnectedWallet ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 sm:mt-6">
            <div>
              <p className="text-sm font-bold text-art-gray-900">
                {snapshot
                  ? `${completedMissionCount} of ${missionCount} missions completed`
                  : "Loading your progress…"}
              </p>
              <p className="mt-1 hidden text-xs text-art-gray-500 sm:block">
                {snapshot?.address.slice(0, 6) || address?.slice(0, 6)}…
                {snapshot?.address.slice(-4) || address?.slice(-4)}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border-2 border-dashed border-art-gray-300 bg-white px-3 py-3 sm:mt-5 sm:px-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5 sm:items-start sm:gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 sm:mt-0.5">
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-art-gray-900">
                    Connect wallet to view progress and claim badges
                  </h2>
                </div>
              </div>
              <button
                type="button"
                className="hand-drawn-btn shrink-0 px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
                disabled={isConnecting || connectors.length === 0}
                onClick={() => {
                  const connector = connectors[0];
                  if (connector) connect({ connector });
                }}
              >
                {isConnecting ? "Connecting…" : "Connect wallet"}
              </button>
            </div>
          </div>
        )}

        {hasConnectedWallet && missionsError && visibleMissions ? (
          <div
            className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
            role="status"
          >
            We couldn’t refresh your progress. Try again shortly.
          </div>
        ) : null}

        {missionContentLoading ? (
          <div
            className="mt-5 grid gap-3 sm:gap-5 md:mt-8 md:grid-cols-3"
            aria-label="Loading missions"
          >
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="h-40 animate-pulse rounded-2xl border-2 border-art-gray-300 bg-white sm:h-80"
              />
            ))}
          </div>
        ) : missionContentError ? (
          <div
            className="mt-5 rounded-xl border-2 border-dashed border-art-gray-300 bg-white px-4 py-4 text-center text-sm font-medium text-art-gray-600 md:mt-8 md:py-5"
            role="status"
          >
            The mission catalog is refreshing. Please check back shortly.
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:gap-5 md:mt-8 md:grid-cols-3">
            {visibleMissions?.map((mission) => (
              <MissionCard
                key={mission.slug}
                mission={mission}
                isClaiming={claimingSlug === mission.slug}
                claimingConfigured={claimingConfigured}
                onClaim={
                  hasConnectedWallet && "progress" in mission
                    ? (selectedMission) => void handleClaim(selectedMission)
                    : undefined
                }
              />
            ))}
          </div>
        )}

        {actionError ? (
          <div
            className="mx-auto mt-6 max-w-2xl rounded-lg border-2 border-red-700 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-800"
            role="alert"
          >
            {actionError}
          </div>
        ) : null}
        {actionNotice ? (
          <div
            className="mx-auto mt-6 max-w-2xl rounded-lg border-2 border-green-700 bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-800"
            role="status"
          >
            {actionNotice}
          </div>
        ) : null}
      </section>
    </div>
  );
}
