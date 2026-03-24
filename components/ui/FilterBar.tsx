"use client";
import { cn, CATEGORY_CONFIG } from "@/lib/utils";
import { ResourceCategory } from "@/types";

interface FilterBarProps {
  activeCategory: ResourceCategory | null;
  onCategoryChange: (cat: ResourceCategory | null) => void;
  categoryCounts?: Record<string, number>;
  className?: string;
}

export function FilterBar({
  activeCategory,
  onCategoryChange,
  categoryCounts = {},
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn("flex items-center gap-1.5 flex-wrap", className)}
      role="group"
      aria-label="Filter by resource category"
    >
      {/* All button */}
      <button
        onClick={() => onCategoryChange(null)}
        aria-pressed={activeCategory === null}
        className={cn(
          "font-mono text-[9px] font-bold tracking-[0.08em] px-2.5 py-1.5 rounded-md border transition-all",
          activeCategory === null
            ? "text-white border-white/20 bg-[#1a1a1a]"
            : "text-[#666] border-white/[0.08] hover:text-white hover:border-white/15 hover:bg-[#111]"
        )}
      >
        ALL
      </button>

      {(Object.keys(CATEGORY_CONFIG) as ResourceCategory[]).map(cat => {
        const { label, color, bg } = CATEGORY_CONFIG[cat];
        const isActive = activeCategory === cat;
        const count = categoryCounts[cat];

        return (
          <button
            key={cat}
            onClick={() => onCategoryChange(isActive ? null : cat)}
            aria-pressed={isActive}
            aria-label={`${label}${count !== undefined ? ` — ${count} resources` : ""}`}
            className="font-mono text-[9px] font-bold tracking-[0.08em] px-2.5 py-1.5 rounded-md border transition-all"
            style={{
              color: isActive ? color : "#666",
              background: isActive ? bg : "transparent",
              borderColor: isActive ? `${color}40` : "rgba(255,255,255,0.08)",
            }}
            onMouseEnter={e => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.color = color;
                (e.currentTarget as HTMLButtonElement).style.background = bg;
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.color = "#666";
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }
            }}
          >
            {label}
            {count !== undefined && (
              <span className="ml-1.5 opacity-60">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
