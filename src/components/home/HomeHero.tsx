import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Brush,
  Coins,
} from "lucide-react";

const journey = [
  {
    title: "Draw",
    description: "Make an original sketch in the browser.",
    icon: Brush,
  },
  {
    title: "Launch",
    description: "Turn it into a coin on Base with Zora.",
    icon: Coins,
  },
  {
    title: "Collect",
    description: "Follow creators and earn onchain badges.",
    icon: BadgeCheck,
  },
];

export default function HomeHero() {
  return (
    <section
      className="mx-auto w-full max-w-7xl px-3 pb-4 pt-3 sm:px-4 sm:pb-8 sm:pt-8 lg:pb-10"
      aria-labelledby="home-hero-title"
    >
      <div className="overflow-hidden rounded-[22px_10px_20px_14px] border-2 border-art-gray-900 bg-white shadow-[4px_4px_0_#171717] sm:rounded-[28px_12px_24px_16px] sm:border-[3px] sm:shadow-[7px_7px_0_#171717]">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <div className="flex flex-col justify-center px-4 py-5 sm:px-9 sm:py-11 lg:px-12 lg:py-14">
            <h1
              id="home-hero-title"
              className="max-w-3xl font-art-sans text-[2.15rem] font-bold leading-[1.04] tracking-[-0.035em] text-art-gray-900 sm:text-6xl sm:leading-[1.02] lg:text-[4.35rem] lg:leading-[1]"
            >
              Draw it. Launch it. Collect the story.
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-5 text-art-gray-600 sm:mt-5 sm:text-lg sm:leading-7">
              <span className="sm:hidden">
                Sketch in your browser, launch on Base, and discover what the
                community makes.
              </span>
              <span className="hidden sm:inline">
                DrawCoin turns an original sketch into an onchain collectible
                on Base. Create in your browser, launch through Zora, then
                discover what the community is making.
              </span>
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-7 sm:flex sm:items-center sm:gap-3">
              <Link
                href="/create"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[16px_7px_14px_9px] border-2 border-art-gray-900 bg-[#0052ff] px-3 py-2.5 text-xs font-bold text-white shadow-[3px_3px_0_#171717] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0052ff] sm:min-h-12 sm:gap-2 sm:rounded-[18px_7px_15px_10px] sm:border-[3px] sm:px-6 sm:py-3 sm:text-sm sm:shadow-[4px_4px_0_#171717]"
              >
                Start drawing
                <ArrowRight
                  aria-hidden="true"
                  size={16}
                  strokeWidth={2.5}
                  className="shrink-0 sm:h-[18px] sm:w-[18px]"
                />
              </Link>
              <a
                href="#collection"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[15px_8px_16px_7px] border-2 border-dashed border-art-gray-500 bg-white px-3 py-2.5 text-xs font-bold text-art-gray-900 transition-colors hover:border-art-gray-900 hover:bg-art-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-art-gray-900 sm:min-h-12 sm:gap-2 sm:rounded-[16px_9px_18px_7px] sm:px-6 sm:py-3 sm:text-sm"
              >
                <span className="sm:hidden">Explore</span>
                <span className="hidden sm:inline">Explore the collection</span>
                <ArrowDown
                  aria-hidden="true"
                  size={16}
                  strokeWidth={2.5}
                  className="shrink-0 sm:h-[18px] sm:w-[18px]"
                />
              </a>
            </div>

            <Link
              href="/missions"
              className="mt-5 hidden w-fit items-center gap-2 text-sm font-semibold text-art-gray-600 underline decoration-art-gray-300 decoration-2 underline-offset-4 transition-colors hover:text-art-gray-900 hover:decoration-[#0052ff] sm:inline-flex"
            >
              Complete missions and claim badges
              <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </div>

          <div className="relative hidden min-h-[420px] items-center justify-center border-l-[3px] border-art-gray-900 bg-[#f2f5ff] p-10 lg:flex">
            <div className="relative w-full max-w-[430px] rotate-[1.5deg] overflow-hidden rounded-[22px_8px_18px_12px] border-[3px] border-art-gray-900 bg-white p-3 shadow-[6px_6px_0_#171717] sm:p-4">
              <Image
                src="/logo.png"
                alt="Hand-drawn DrawCoin wordmark"
                width={1024}
                height={1024}
                sizes="(min-width: 1024px) 38vw, 1px"
                className="aspect-square h-auto w-full rounded-[16px_6px_14px_9px] object-cover"
              />
              <div className="absolute bottom-6 left-6 rounded-full border-2 border-art-gray-900 bg-[#ffd166] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-art-gray-900 shadow-[2px_2px_0_#171717] sm:bottom-8 sm:left-8">
                Original work lives here
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 border-t-2 border-art-gray-900 bg-[#fffdf7] sm:border-t-[3px]">
          {journey.map(({ title, description, icon: Icon }, index) => (
            <div
              key={title}
              className={`flex min-w-0 items-center justify-center gap-1.5 px-1.5 py-3 sm:items-start sm:justify-start sm:gap-3 sm:px-6 sm:py-5 ${
                index > 0
                  ? "border-l-2 border-dashed border-art-gray-300"
                  : ""
              }`}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px_4px_8px_5px] border-2 border-art-gray-900 bg-white shadow-[1px_1px_0_#171717] sm:h-10 sm:w-10 sm:rounded-[12px_5px_10px_7px] sm:shadow-[2px_2px_0_#171717]">
                <Icon
                  aria-hidden="true"
                  size={15}
                  strokeWidth={2.4}
                  className="sm:h-[19px] sm:w-[19px]"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold text-art-gray-900 sm:text-base">
                  {title}
                </p>
                <p className="mt-0.5 hidden text-xs leading-5 text-art-gray-600 sm:block">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
