import { useState } from "react";
import { Grid2X2, List, Search, SlidersHorizontal, X } from "lucide-react";

export type CreationType = "all" | "ai" | "hand-drawn";
export type MarketSort =
  | "newest"
  | "oldest"
  | "most-watched"
  | "market-cap"
  | "recently-traded"
  | "most-holders";
export type MarketActivity = "all" | "traded";
export type MinimumHolders = 0 | 2 | 5;

interface TokenFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  sortBy: MarketSort;
  onSortChange: (sort: MarketSort) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  creationType: CreationType;
  onCreationTypeChange: (type: CreationType) => void;
  activity: MarketActivity;
  onActivityChange: (activity: MarketActivity) => void;
  minHolders: MinimumHolders;
  onMinHoldersChange: (minimum: MinimumHolders) => void;
}

const sortOptions: ReadonlyArray<{ value: MarketSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "recently-traded", label: "Recent trades" },
  { value: "market-cap", label: "Market cap" },
  { value: "most-watched", label: "Most watched" },
  { value: "most-holders", label: "Most holders" },
  { value: "oldest", label: "Oldest" },
];

export default function TokenFilters({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  creationType,
  onCreationTypeChange,
  activity,
  onActivityChange,
  minHolders,
  onMinHoldersChange,
}: TokenFiltersProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const extraFilterCount = Number(activity === "traded") + Number(minHolders > 0);

  return (
    <section aria-label="Explore controls" className="mb-3 sm:mb-4">
      <div className="rounded-2xl border-2 border-[#2d3748] bg-white p-2.5 shadow-[3px_3px_0_#2d3748] sm:p-3">
        <div className="space-y-2.5">
          <label className="relative block min-w-0">
            <span className="sr-only">Search art coins</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-art-gray-400" />
            <input
              type="search"
              inputMode="search"
              autoComplete="off"
              maxLength={100}
              placeholder="Search name, symbol, creator, or contract"
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              className="h-11 w-full rounded-xl border-2 border-art-gray-300 bg-art-off-white pl-9 pr-9 text-sm font-medium text-art-gray-900 outline-none placeholder:text-art-gray-400 focus:border-[#0052ff] focus:ring-2 focus:ring-[#0052ff]/20 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-art-gray-500 hover:bg-art-gray-200 focus-visible:ring-2 focus-visible:ring-[#0052ff]"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </label>

          <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div role="group" aria-label="Filter by artwork type" className="flex h-10 shrink-0 items-center rounded-xl border-2 border-[#2d3748] bg-white p-0.5">
              {(["all", "hand-drawn", "ai"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={creationType === type}
                  onClick={() => onCreationTypeChange(type)}
                  className={`h-8 rounded-lg px-2.5 text-xs font-bold transition focus-visible:ring-2 focus-visible:ring-[#0052ff] sm:px-3 ${creationType === type ? "bg-[#0052ff] text-white" : "text-art-gray-600 hover:bg-[#eef3ff]"}`}
                >
                  {type === "all" ? (
                    "All"
                  ) : type === "hand-drawn" ? (
                    <><span className="sm:hidden">Hand</span><span className="hidden sm:inline">Hand drawn</span></>
                  ) : (
                    <><span className="sm:hidden">AI</span><span className="hidden sm:inline">AI archive</span></>
                  )}
                </button>
              ))}
            </div>

            <label className="min-w-0 shrink-0">
              <span className="sr-only">Sort coins</span>
              <select
                aria-label="Sort coins"
                value={sortBy}
                onChange={(event) => onSortChange(event.target.value as MarketSort)}
                className={`h-10 min-w-[108px] rounded-xl border-2 bg-white px-2 text-xs font-bold outline-none focus:border-[#0052ff] focus:ring-2 focus:ring-[#0052ff]/20 sm:min-w-[122px] sm:px-2.5 ${sortBy === "newest" ? "border-art-gray-300" : "border-[#0052ff] bg-[#eef3ff] text-[#003ecb]"}`}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              aria-expanded={moreOpen}
              aria-controls="explore-extra-filters"
              onClick={() => setMoreOpen((open) => !open)}
              className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl border-2 px-2.5 text-xs font-bold transition focus-visible:ring-2 focus-visible:ring-[var(--base-blue)] ${
                extraFilterCount > 0
                  ? "border-[var(--base-blue)] bg-[var(--base-blue-soft)] text-[var(--base-blue-hover)]"
                  : "border-[#2d3748] bg-white text-art-gray-600 hover:bg-art-gray-100"
              }`}
            >
              <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
              Filters{extraFilterCount > 0 ? ` ${extraFilterCount}` : ""}
            </button>

            <div role="group" aria-label="Token view" className="ml-auto flex h-10 shrink-0 items-center rounded-xl border-2 border-[#2d3748] bg-white p-0.5">
              {(["grid", "list"] as const).map((mode) => {
                const Icon = mode === "grid" ? Grid2X2 : List;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-label={`Show coins in a ${mode}`}
                    aria-pressed={viewMode === mode}
                    onClick={() => onViewModeChange(mode)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-[#0052ff] ${viewMode === mode ? "bg-art-gray-900 text-white" : "text-art-gray-500 hover:bg-art-gray-100"}`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {moreOpen ? (
            <div
              id="explore-extra-filters"
              className="grid gap-2 rounded-xl border border-art-gray-200 bg-art-off-white p-2 sm:grid-cols-2"
            >
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-art-gray-500">Activity</p>
                <div className="flex gap-1" role="group" aria-label="Filter by trading activity">
                  {(["all", "traded"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={activity === value}
                      onClick={() => onActivityChange(value)}
                      className={`h-9 flex-1 rounded-lg px-2 text-xs font-bold ${activity === value ? "bg-art-gray-900 text-white" : "bg-white text-art-gray-600 hover:bg-art-gray-100"}`}
                    >
                      {value === "all" ? "All activity" : "Has trades"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-art-gray-500">Minimum holders</p>
                <div className="flex gap-1" role="group" aria-label="Minimum holder count">
                  {([0, 2, 5] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={minHolders === value}
                      onClick={() => onMinHoldersChange(value)}
                      className={`h-9 flex-1 rounded-lg px-2 text-xs font-bold ${minHolders === value ? "bg-art-gray-900 text-white" : "bg-white text-art-gray-600 hover:bg-art-gray-100"}`}
                    >
                      {value === 0 ? "Any" : `${value}+`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

      </div>
    </section>
  );
}
