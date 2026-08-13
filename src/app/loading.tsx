export default function Loading() {
  return (
    <section
      className="mx-auto w-full max-w-7xl bg-art-gray-50 px-4 pb-28 pt-5 sm:pt-8 md:pb-12"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading DrawCoin</span>
      <div className="overflow-hidden rounded-[28px_12px_24px_16px] border-[3px] border-art-gray-900 bg-white shadow-[7px_7px_0_#171717]">
        <div className="grid lg:grid-cols-2">
          <div className="space-y-5 px-5 py-10 sm:px-9 lg:px-12 lg:py-16">
            <div className="h-8 w-40 rounded-full bg-[#e8f0ff] motion-safe:animate-pulse" />
            <div className="h-14 w-full max-w-xl rounded-xl bg-art-gray-200 motion-safe:animate-pulse sm:h-20" />
            <div className="h-14 w-4/5 max-w-lg rounded-xl bg-art-gray-100 motion-safe:animate-pulse" />
            <div className="flex gap-3 pt-2">
              <div className="h-12 w-36 rounded-xl bg-[#0052ff]/20 motion-safe:animate-pulse" />
              <div className="h-12 w-44 rounded-xl bg-art-gray-100 motion-safe:animate-pulse" />
            </div>
          </div>
          <div className="flex min-h-[310px] items-center justify-center border-t-[3px] border-art-gray-900 bg-[#f2f5ff] p-7 lg:border-l-[3px] lg:border-t-0">
            <div className="aspect-square w-full max-w-sm rounded-[22px_8px_18px_12px] border-[3px] border-art-gray-900 bg-white p-4 shadow-[5px_5px_0_#171717]">
              <div className="h-full w-full rounded-[16px_6px_14px_9px] bg-art-gray-100 motion-safe:animate-pulse" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="aspect-[4/3] rounded-[20px_8px_18px_12px] border-2 border-art-gray-300 bg-white p-4"
          >
            <div className="h-3/4 rounded-xl bg-art-gray-100 motion-safe:animate-pulse" />
            <div className="mt-4 h-5 w-2/3 rounded bg-art-gray-200 motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}
