"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import {
  getDailyDrawingPrompt,
  getLocalDateKey,
  type DrawingPrompt,
} from "./dailyDrawingPrompts";

export interface DailyDrawingPromptProps {
  /** Optional stable YYYY-MM-DD value for server-controlled rendering or tests. */
  dateKey?: string;
  className?: string;
}

const MIDNIGHT_TIMER_BUFFER_MS = 100;

function millisecondsUntilNextLocalDay(now: Date): number {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(
    MIDNIGHT_TIMER_BUFFER_MS,
    nextMidnight.getTime() - now.getTime() + MIDNIGHT_TIMER_BUFFER_MS
  );
}

export default function DailyDrawingPrompt({
  dateKey,
  className = "",
}: DailyDrawingPromptProps) {
  const titleId = `${useId()}-daily-drawing-prompt`;
  const [prompt, setPrompt] = useState<DrawingPrompt | null>(() =>
    dateKey ? getDailyDrawingPrompt(dateKey) : null
  );

  useEffect(() => {
    if (dateKey) {
      setPrompt(getDailyDrawingPrompt(dateKey));
      return;
    }

    let timeoutId: number | undefined;

    const refreshForCurrentDay = () => {
      const now = new Date();
      setPrompt(getDailyDrawingPrompt(getLocalDateKey(now)));
      timeoutId = window.setTimeout(
        refreshForCurrentDay,
        millisecondsUntilNextLocalDay(now)
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      refreshForCurrentDay();
    };

    refreshForCurrentDay();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dateKey]);

  return (
    <aside
      aria-labelledby={titleId}
      className={`overflow-hidden rounded-[18px_8px_16px_10px] border-2 border-art-gray-900 bg-[#fff8dc] px-3 py-2.5 shadow-[3px_3px_0_#171717] sm:px-4 sm:py-3.5 ${className}`.trim()}
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 rotate-[-2deg] items-center justify-center rounded-[10px_4px_9px_6px] border-2 border-art-gray-900 bg-white text-base font-bold text-[#0052ff] shadow-[1px_1px_0_#171717] sm:h-9 sm:w-9"
        >
          &#10022;
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-art-gray-500 sm:text-[11px]">
            Today&apos;s drawing idea
          </p>
          <h2
            id={titleId}
            className="mt-0.5 min-h-5 text-sm font-bold leading-5 text-art-gray-900 sm:text-base sm:leading-6"
          >
            {prompt?.idea ?? (
              <span className="text-art-gray-500">
                Finding today&apos;s idea&hellip;
              </span>
            )}
          </h2>

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 sm:mt-2">
            <p className="text-[11px] leading-4 text-art-gray-600 sm:text-xs">
              A verified creation progresses First Stroke.
            </p>
            <Link
              href="/missions"
              aria-label="View the First Stroke mission"
              className="inline-flex min-h-7 items-center gap-1 text-[11px] font-bold text-[#0052ff] underline decoration-2 underline-offset-2 transition-colors hover:text-blue-800 sm:text-xs"
            >
              View mission
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
