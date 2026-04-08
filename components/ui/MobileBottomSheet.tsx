"use client";
import { useRef, useEffect } from "react";
import { Resource, ResourceCategory } from "@/types";
import { CATEGORY_CONFIG } from "@/lib/utils";
import { ResourceCard } from "./ResourceCard";
import { cn } from "@/lib/utils";

interface MobileBottomSheetProps {
  resources: Resource[];
  totalCount?: number;
  activeCategory: ResourceCategory | null;
  onCategoryChange: (cat: ResourceCategory | null) => void;
  isLoading?: boolean;
  selectedResourceId?: string | null;
  onSelectResource?: (id: string) => void;
  lang?: string;
}

export function MobileBottomSheet({
  resources,
  totalCount = 0,
  activeCategory,
  onCategoryChange,
  isLoading,
  selectedResourceId,
  onSelectResource,
  lang = "EN",
}: MobileBottomSheetProps) {
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll selected card into view when selection changes (e.g. from map pin tap)
  useEffect(() => {
    if (!selectedResourceId) return;
    const el = cardRefs.current.get(selectedResourceId);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedResourceId]);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 pointer-events-none">
      {/* Fade gradient into the sheet */}
      <div
        className="h-6 pointer-events-none"
        style={{ background: "linear-gradient(to top, var(--surface-0) 0%, transparent 100%)" }}
      />

      {/* Sheet content */}
      <div className="bg-surface-0 border-t border-border pointer-events-auto shadow-2xl">
        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 pt-2 pb-2">
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
        <div className="flex gap-3 overflow-x-auto no-scrollbar px-3 pb-4">
          {isLoading ? (
            <div className="font-mono text-[11px] text-content-muted animate-pulse py-3 px-1 tracking-[0.1em]">
              LOADING...
            </div>
          ) : resources.length === 0 ? (
            <div className="font-mono text-[11px] text-content-muted py-3 px-1 tracking-[0.08em]">
              {totalCount > 0
                ? `ZOOM OUT TO SEE ${totalCount} RESULT${totalCount !== 1 ? "S" : ""}`
                : "NO RESOURCES — SELECT A STATE ON THE MAP"}
            </div>
          ) : (
            resources.slice(0, 20).map((r) => (
              <div
                key={r.id}
                className="flex-shrink-0 w-[260px] [&_article]:!p-2 [&_a.block]:!py-1"
                ref={el => { if (el) cardRefs.current.set(r.id, el); else cardRefs.current.delete(r.id); }}
              >
                <ResourceCard
                  resource={r}
                  compact
                  selected={selectedResourceId === r.id}
                  onClick={onSelectResource ? () => onSelectResource(r.id) : undefined}
                  lang={lang}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
