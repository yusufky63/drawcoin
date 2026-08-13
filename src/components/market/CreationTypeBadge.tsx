interface CreationTypeBadgeProps {
  creationType?: string | null;
  className?: string;
  compact?: boolean;
}

export function CreationTypeBadge({
  creationType,
  className = "",
  compact = false,
}: CreationTypeBadgeProps) {
  if (!creationType) return null;

  const isAiArchive = creationType === "ai";

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap border-art-gray-900 font-bold uppercase tracking-[0.08em] text-art-gray-900 ${
        compact
          ? "rounded-[7px_3px_6px_4px] border px-1.5 py-0.5 text-[8px] shadow-[1px_1px_0_#171717]"
          : "rounded-[12px_6px_10px_7px] border-2 px-2.5 py-1 text-[9px] shadow-[2px_2px_0_#171717]"
      } ${isAiArchive ? "bg-[#e8e5ff]" : "bg-[#ffd166]"} ${className}`}
    >
      {isAiArchive ? "AI Archive" : "Hand Drawn"}
    </span>
  );
}
