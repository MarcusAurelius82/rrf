"use client";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { CATEGORY_CONFIG } from "@/lib/utils";
import { ResourceCategory } from "@/types";
import { SearchInput } from "./SearchInput";

interface SidebarProps {
  activeCategory: ResourceCategory | null;
  onCategoryChange: (cat: ResourceCategory | null) => void;
  categoryCounts: Record<string, number>;
  onReportMissing: () => void;
  onClose?: () => void;
  searchQuery?: string;
  onSearch?: (query: string) => void;
}

export function Sidebar({
  activeCategory,
  onCategoryChange,
  categoryCounts,
  onReportMissing,
  onClose,
  searchQuery = "",
  onSearch,
}: SidebarProps) {
  const touchStartX = useRef<number | null>(null);

  return (
    <aside
      className="w-full md:w-[220px] flex-shrink-0 border-r border-border bg-surface-0 flex flex-col py-4 overflow-y-auto h-full"
      aria-label="Resource category filters"
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (delta < -50) onClose?.();
      }}
    >
      {/* Mobile header */}
      {onClose && (
        <div className="flex items-center justify-between px-3.5 pb-3 mb-1 border-b border-border-subtle md:hidden">
          <span className="font-mono text-[11px] font-semibold text-content-secondary tracking-[0.08em]">FILTERS</span>
          <button
            onClick={onClose}
            aria-label="Close filters"
            className="w-11 h-11 md:w-7 md:h-7 flex items-center justify-center rounded-md text-content-tertiary hover:text-content-primary hover:bg-border transition-all text-[12px]"
          >
            ✕
          </button>
        </div>
      )}

      <div className="px-3.5 pb-4">
        {/* Search input */}
        {onSearch && (
          <div className="mb-3">
            <SearchInput
              value={searchQuery}
              onChange={onSearch}
              onSearch={onSearch}
              placeholder="Search resources…"
            />
          </div>
        )}

        <div className="font-mono text-[11px] md:text-[9px] font-semibold text-content-muted tracking-[0.12em] mb-1" aria-hidden="true">
          RESOURCES
        </div>
        <div className="font-mono text-[12px] md:text-[11px] font-semibold text-content-tertiary tracking-[0.06em] mb-3" aria-hidden="true">
          FILTER_BY_TYPE
        </div>

        <div role="group" aria-label="Filter by category">
          {(Object.keys(CATEGORY_CONFIG) as ResourceCategory[]).map(cat => {
            const { label, icon, color, bg } = CATEGORY_CONFIG[cat];
            const count = categoryCounts[cat] || 0;
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => onCategoryChange(isActive ? null : cat)}
                aria-pressed={isActive}
                aria-label={`${label} — ${count} resource${count !== 1 ? "s" : ""}${isActive ? " (active)" : ""}`}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-3 md:py-2 rounded-md mb-0.5 border transition-all",
                  isActive
                    ? "bg-surface-2 border-border"
                    : "bg-transparent border-transparent hover:bg-surface-1"
                )}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] flex-shrink-0"
                  style={{ background: bg, color }}
                  aria-hidden="true"
                >
                  {icon}
                </div>
                <span
                  className="font-mono text-[11px] md:text-[10px] font-semibold tracking-[0.08em] flex-1 text-left"
                  style={{ color: isActive ? color : "var(--text-secondary)" }}
                >
                  {label}
                </span>
                <span
                  className="font-mono text-[9px] text-content-tertiary bg-surface-1 px-1.5 py-0.5 rounded-full border border-border-subtle"
                  aria-hidden="true"
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-border-subtle mx-3.5 my-1" role="separator" />

      <div className="px-3.5 mt-3">
        <button
          onClick={onReportMissing}
          className="w-full text-left font-mono text-[10px] font-medium text-content-tertiary px-2.5 py-2 rounded-md border border-border hover:border-border-active hover:text-content-primary hover:bg-surface-2 transition-all"
          aria-label="Report a missing resource"
        >
          + Report Missing Resource
        </button>
      </div>

      <div className="mt-auto pt-4 px-3.5">
        <nav aria-label="Support links">
          <a
            href="mailto:support@refugee-node.org"
            className="flex w-full text-left font-mono text-[10px] text-content-muted px-1 py-1.5 hover:text-content-secondary transition-colors tracking-[0.06em]"
          >
            ⊙  SUPPORT
          </a>
          <a
            href="/faq"
            className="flex w-full text-left font-mono text-[10px] text-content-muted px-1 py-1.5 hover:text-content-secondary transition-colors tracking-[0.06em]"
          >
            ?  FAQ
          </a>
        </nav>
      </div>
    </aside>
  );
}
