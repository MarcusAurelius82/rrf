"use client";
import { Resource, ResourceCategory } from "@/types";
import { CATEGORY_CONFIG } from "@/lib/utils";
import { ResourceCard } from "./ResourceCard";
import { cn } from "@/lib/utils";

interface MobileBottomSheetProps {
  resources: Resource[];
  activeCategory: ResourceCategory | null;
  onCategoryChange: (cat: ResourceCategory | null) => void;
  isLoading?: boolean;
}

export function MobileBottomSheet({
  resources,
  activeCategory,
  onCategoryChange,
  isLoading,
}: MobileBottomSheetProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 pointer-events-none">
      {/* Fade gradient into the sheet */}
      <div className="h-10 bg-gradient-to-t from-[#0a0a0a]/80 to-transparent" />

      {/* Sheet content */}
      <div className="bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-white/[0.08] pointer-events-auto">
        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 pt-2.5 pb-2">
          <button
            onClick={() => onCategoryChange(null)}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-full font-mono text-[9px] font-bold tracking-[0.08em] border transition-all",
              activeCategory === null
                ? "bg-accent border-accent text-white"
                : "bg-transparent border-white/[0.15] text-content-muted hover:border-white/[0.25] hover:text-content-secondary"
            )}
          >
            ALL
          </button>
          {(Object.entries(CATEGORY_CONFIG) as [ResourceCategory, (typeof CATEGORY_CONFIG)[ResourceCategory]][]).map(
            ([key, cat]) => (
              <button
                key={key}
                onClick={() => onCategoryChange(activeCategory === key ? null : key)}
                className={cn(
                  "flex-shrink-0 px-3 py-1.5 rounded-full font-mono text-[9px] font-bold tracking-[0.08em] border transition-all",
                  activeCategory === key
                    ? "border-transparent text-white"
                    : "bg-transparent border-white/[0.15] text-content-muted hover:border-white/[0.25] hover:text-content-secondary"
                )}
                style={
                  activeCategory === key
                    ? { background: cat.color, borderColor: cat.color }
                    : undefined
                }
              >
                {cat.icon} {cat.label}
              </button>
            )
          )}
        </div>

        {/* Horizontal cards row */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar px-3 pb-5">
          {isLoading ? (
            <div className="font-mono text-[11px] text-content-muted animate-pulse py-3 px-1 tracking-[0.1em]">
              LOADING...
            </div>
          ) : resources.length === 0 ? (
            <div className="font-mono text-[11px] text-content-muted py-3 px-1 tracking-[0.08em]">
              NO RESOURCES — SELECT A STATE ON THE MAP
            </div>
          ) : (
            resources.slice(0, 20).map((r) => (
              <div key={r.id} className="flex-shrink-0 w-[220px]">
                <ResourceCard resource={r} compact />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
