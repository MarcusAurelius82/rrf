"use client";
import { useRef, useEffect } from "react";
import { Resource, ResourceCategory } from "@/types";
import { CATEGORY_CONFIG } from "@/lib/utils";
import { ResourceCard } from "./ResourceCard";
import { cn } from "@/lib/utils";

interface MobileBottomSheetProps {
  resources: Resource[];
  activeCategory: ResourceCategory | null;
  onCategoryChange: (cat: ResourceCategory | null) => void;
  isLoading?: boolean;
  selectedResourceId?: string | null;
  onSelectResource?: (id: string) => void;
  collapsed?: boolean;
  onCollapse?: () => void;
}

export function MobileBottomSheet({
  resources,
  activeCategory,
  onCategoryChange,
  isLoading,
  selectedResourceId,
  onSelectResource,
  collapsed = false,
  onCollapse,
}: MobileBottomSheetProps) {
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const touchStartY = useRef<number | null>(null);

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
        className="h-10 pointer-events-none"
        style={{ background: "linear-gradient(to top, var(--surface-0) 0%, transparent 100%)" }}
      />

      {/* Sheet content */}
      <div
        className="bg-surface-0 border-t border-border pointer-events-auto shadow-2xl"
        onTouchStart={e => { touchStartY.current = e.touches[0].clientY; }}
        onTouchEnd={e => {
          if (touchStartY.current === null) return;
          const delta = e.changedTouches[0].clientY - touchStartY.current;
          touchStartY.current = null;
          if (delta > 48) onCollapse?.(); // swipe down ≥ 48px → collapse
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-8 h-1 rounded-full bg-border-active" aria-hidden="true" />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 pt-1 pb-2">
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

        {/* Horizontal cards row — slides away when map is tapped */}
        <div className={cn(
          "flex gap-3 overflow-x-auto no-scrollbar px-3 transition-all duration-300 ease-in-out",
          collapsed ? "max-h-0 pb-0 opacity-0 overflow-hidden" : "max-h-[300px] pb-5 opacity-100"
        )}>
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
              <div
                key={r.id}
                className="flex-shrink-0 w-[220px]"
                ref={el => { if (el) cardRefs.current.set(r.id, el); else cardRefs.current.delete(r.id); }}
              >
                <ResourceCard
                  resource={r}
                  compact
                  selected={selectedResourceId === r.id}
                  onClick={onSelectResource ? () => onSelectResource(r.id) : undefined}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
