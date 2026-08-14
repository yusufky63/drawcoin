"use client";

import { Camera, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

import type { TickerResponseDto, TickerTokenDto } from "@/lib/market/tickerDto";

import { SafeImage } from "../ui/SafeImage";

async function fetchTicker(url: string): Promise<TickerResponseDto> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Ticker data is unavailable.");
    return response.json() as Promise<TickerResponseDto>;
  } finally {
    window.clearTimeout(timeout);
  }
}

function formatUsd(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  if (value === 0) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  if (value >= 0.0001) return `$${value.toFixed(6)}`;
  return `$${value.toExponential(2)}`;
}

function formatCount(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  return Math.floor(value).toLocaleString("en-US");
}

function tickerItems(tokens: TickerTokenDto[], copy: "primary" | "duplicate") {
  return tokens.map((token) => {
    const marketCap = formatUsd(token.marketCapUsd);
    const holders = formatCount(token.holders);
    const activity = token.lastActivity?.type;
    const accessibleMetrics = [
      marketCap ? `market cap ${marketCap}` : "market cap unavailable",
      holders !== null ? `${holders} holders` : null,
    ].filter(Boolean);
    return (
      <Link
        key={`${copy}-${token.address}`}
        href={`/coin/${token.address}`}
        tabIndex={copy === "duplicate" ? -1 : undefined}
        aria-label={`${token.name}${accessibleMetrics.length ? `, ${accessibleMetrics.join(", ")}` : ""}`}
        className="mx-2 inline-flex h-9 shrink-0 items-center gap-2 rounded-[12px_5px_10px_7px] border border-transparent px-2 text-[10px] text-art-gray-600 transition-colors hover:border-[#0052ff]/25 hover:bg-white hover:text-art-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052ff] sm:mx-3 sm:text-[11px]"
      >
        <SafeImage
          src={token.imageUrl || "/icon.png"}
          alt=""
          width={20}
          height={20}
          fallbackText=""
          fallbackIcon={<Camera aria-hidden="true" size={10} />}
          className="h-5 w-5 rounded-full border border-art-gray-300 object-cover [&_.text-retro-primary]:mb-0 [&_.text-retro-secondary]:hidden"
        />
        <span className="max-w-28 truncate font-bold text-art-gray-900 sm:max-w-40">
          {token.name}
        </span>
        {activity ? (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${
              activity === "buy"
                ? "bg-emerald-50 text-emerald-700"
                : activity === "sell"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-white text-[#0052ff]"
            }`}
          >
            {activity}
          </span>
        ) : null}
        <span
          className="inline-flex items-baseline gap-1 tabular-nums"
          title={
            token.metricsUpdatedAt
              ? `Supabase snapshot: ${new Date(token.metricsUpdatedAt).toLocaleString()}`
              : "Supabase market snapshot unavailable"
          }
        >
          <span className="text-[8px] font-bold uppercase tracking-wide text-art-gray-400">
            MC
          </span>
          <span className="font-semibold text-art-gray-700">
            {marketCap ?? "\u2014"}
          </span>
        </span>
        {holders !== null ? (
          <span className="hidden items-baseline gap-1 border-l border-art-gray-300 pl-2 tabular-nums sm:inline-flex">
            <span className="font-semibold text-art-gray-700">{holders}</span>
            <span className="text-[8px] font-bold uppercase tracking-wide text-art-gray-400">Holders</span>
          </span>
        ) : null}
      </Link>
    );
  });
}

export default function TokenTicker() {
  const [isPaused, setIsPaused] = useState(false);
  const { data } = useSWR<TickerResponseDto>("/api/market/ticker", fetchTicker, {
    refreshInterval: 120_000,
    dedupingInterval: 30_000,
    keepPreviousData: true,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    errorRetryCount: 2,
    errorRetryInterval: 10_000,
  });
  const tokens = data?.data ?? [];
  if (tokens.length === 0) return null;

  return (
    <aside
      aria-label="Latest DrawCoin market activity"
      className="ticker-shell relative h-10 overflow-hidden border-b-2 border-[#2d3748] bg-[#fffdf7]"
    >
      <div className="ticker-viewport relative h-full min-w-0 overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[#fffdf7] to-transparent" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#fffdf7] via-[#fffdf7]/80 to-transparent" />
        <div
          className={`ticker-track flex h-full w-max items-center whitespace-nowrap ${isPaused ? "ticker-paused" : ""}`}
        >
          <div className="ticker-primary flex shrink-0 items-center">
            {tickerItems(tokens, "primary")}
          </div>
          <div
            aria-hidden="true"
            className="ticker-duplicate flex shrink-0 items-center"
          >
            {tickerItems(tokens, "duplicate")}
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-label={isPaused ? "Resume market ticker" : "Pause market ticker"}
        aria-pressed={isPaused}
        onClick={() => setIsPaused((current) => !current)}
        className="absolute right-2 top-1/2 z-20 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[9px_4px_8px_5px] border border-art-gray-400 bg-white text-art-gray-700 shadow-[1px_1px_0_#2d3748] transition-colors hover:border-[#0052ff] hover:text-[#0052ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052ff]"
      >
        {isPaused ? (
          <Play aria-hidden="true" size={12} fill="currentColor" />
        ) : (
          <Pause aria-hidden="true" size={12} fill="currentColor" />
        )}
      </button>

      <style jsx>{`
        .ticker-track {
          animation: drawcoin-ticker-marquee 42s linear infinite;
          will-change: transform;
        }
        .ticker-paused {
          animation-play-state: paused;
        }
        .ticker-viewport {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .ticker-viewport::-webkit-scrollbar {
          display: none;
        }
        @keyframes drawcoin-ticker-marquee {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-track {
            animation-duration: 72s !important;
            animation-iteration-count: infinite !important;
          }
        }
      `}</style>
    </aside>
  );
}
