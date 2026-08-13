"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      className="flex min-h-[68vh] items-center justify-center bg-art-gray-50 px-4 py-16 pb-28 md:pb-16"
      aria-labelledby="error-title"
    >
      <div className="w-full max-w-2xl rounded-[28px_12px_24px_16px] border-[3px] border-art-gray-900 bg-white p-7 text-center shadow-[7px_7px_0_#171717] sm:p-10">
        <div
          className="mx-auto flex h-16 w-16 rotate-[-2deg] items-center justify-center rounded-[18px_8px_16px_10px] border-[3px] border-art-gray-900 bg-[#ffd166] text-3xl font-bold shadow-[3px_3px_0_#171717]"
          aria-hidden="true"
        >
          !
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#0052ff]">
          The line slipped
        </p>
        <h1
          id="error-title"
          className="mt-2 font-art-display text-4xl font-bold tracking-tight text-art-gray-900 sm:text-5xl"
        >
          This page needs another stroke.
        </h1>
        <p className="mx-auto mt-4 max-w-lg leading-7 text-art-gray-600">
          Something interrupted the page while it was loading. Try the same
          action again, or return to the community sketchbook.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="min-h-12 rounded-[18px_7px_15px_10px] border-[3px] border-art-gray-900 bg-[#0052ff] px-6 py-3 text-sm font-bold text-white shadow-[4px_4px_0_#171717] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0052ff]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-[16px_9px_18px_7px] border-2 border-dashed border-art-gray-500 bg-white px-6 py-3 text-sm font-bold text-art-gray-900 transition-colors hover:border-art-gray-900 hover:bg-art-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-art-gray-900"
          >
            Back to Explore
          </Link>
        </div>
      </div>
    </section>
  );
}
