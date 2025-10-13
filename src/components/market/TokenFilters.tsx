import React from "react";

interface TokenFiltersProps {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
}

export default function TokenFilters({
  categories,
  selectedCategory,
  onCategoryChange,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
}: TokenFiltersProps) {
  const sortOptions = [
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
    { value: "price-high", label: "Price: High to Low" },
    { value: "price-low", label: "Price: Low to High" },
    { value: "volume-high", label: "Volume: High to Low" },
    { value: "holders-high", label: "Holders: High to Low" },
  ];

  return (
    <div className="space-y-2 md:space-y-4 mb-2 md:mb-4">
      {/* Mobile: Filter üstte, Input ve View Mode altta */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
        {/* Sort Filter - Mobile'da üstte */}
        <div className="md:flex md:items-center">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="hand-drawn-input text-sm w-full md:w-auto"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Search ve View Mode - Mobile'da altta, Desktop'ta yan yana */}
        <div className="flex items-center space-x-2 md:space-x-3 gap-1 md:gap-2 w-full">
          {/* Search */}
          <div className="flex-1 w-full sm:mx-2">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-4 w-4 text-art-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ strokeWidth: 2 }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search hand-drawn art tokens..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="hand-drawn-input w-full pl-9 text-sm"
              />
            </div>
          </div>

          {/* View Mode Toggle */}
          <div
            className="flex items-center border-2 border-art-gray-900 rounded-art p-1 flex-shrink-0"
            style={{ borderRadius: "15px 5px 10px 8px" }}
          >
            <button
              onClick={() => onViewModeChange("grid")}
              className={`p-1.5 transition-all duration-200  ${
                viewMode === "grid"
                  ? "bg-art-gray-900 text-art-white"
                  : "text-art-gray-500 hover:text-art-gray-700"
              }`}
              style={{
                transform: viewMode === "grid" ? "rotate(-1deg)" : "rotate(1deg)",
              }}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ strokeWidth: 2 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </button>
            <button
              onClick={() => onViewModeChange("list")}
              className={`p-1.5 transition-all duration-200  ${
                viewMode === "list"
                  ? "bg-art-gray-900 text-art-white"
                  : "text-art-gray-500 hover:text-art-gray-700"
              }`}
              style={{
                transform: viewMode === "list" ? "rotate(-1deg)" : "rotate(1deg)",
              }}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ strokeWidth: 2 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
