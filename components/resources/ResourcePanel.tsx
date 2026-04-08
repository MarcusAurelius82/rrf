"use client";
import { useState, useRef, useEffect } from "react";
import { Resource } from "@/types";
import { ResourceCard } from "@/components/ui/ResourceCard";
import { SearchInput } from "@/components/ui/SearchInput";
import { cn } from "@/lib/utils";
import { useT, UIKey } from "@/contexts/TranslationContext";

type DocFilter = "all" | "none" | "id_only";

const DOC_FILTER_KEY: Record<DocFilter, UIKey> = {
  all:     "ALL_RESOURCES",
  none:    "NO_DOCS",
  id_only: "ID_ONLY",
};

interface ResourcePanelProps {
  resources: Resource[];
  totalCount?: number;
  selectedState: string | null;
  isLoading?: boolean;
  aiSummary?: string;
  onSearch: (query: string) => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onClose?: () => void;
  selectedResourceId?: string | null;
  onSelectResource?: (id: string) => void;
}

export function ResourcePanel({
  resources,
  totalCount = 0,
  selectedState,
  isLoading,
  onSearch,
  searchQuery,
  onSearchChange,
  onClose,
  selectedResourceId,
  onSelectResource,
}: ResourcePanelProps) {
  const t = useT();
  const [docFilter, setDocFilter] = useState<DocFilter>("all");
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const touchStartX = useRef<number | null>(null);

  // Scroll selected card into view when selection changes (e.g. from map click)
  useEffect(() => {
    if (!selectedResourceId) return;
    const el = cardRefs.current.get(selectedResourceId);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedResourceId]);

  const filteredResources = docFilter === "all"
    ? resources
    : resources.filter(r => r.documentation_required === docFilter);

  const urgentCount = filteredResources.filter(r => r.urgent).length;

  return (
    <section
      className="w-full md:w-[340px] flex-shrink-0 border-l border-border bg-surface-0 flex flex-col overflow-hidden h-full"
      aria-label="Resource list"
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (delta > 50) onClose?.();
      }}
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="font-mono text-[11px] md:text-[9px] font-semibold text-content-muted tracking-[0.12em]">
              {t("LOCAL_RESOURCES")}{selectedState ? ` — ${selectedState}` : ""}
            </div>
            {urgentCount > 0 && (
              <span className="font-mono text-[9px] md:text-[8px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
                {urgentCount} {t("URGENT")}
              </span>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close resource panel"
              className="w-11 h-11 md:w-7 md:h-7 flex items-center justify-center rounded-md text-content-tertiary hover:text-content-primary hover:bg-border transition-all text-[12px] md:hidden"
            >
              ✕
            </button>
          )}
        </div>
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          onSearch={onSearch}
          placeholder="Search resources…"
        />
        {/* Documentation filter */}
        <div className="mt-2.5 flex flex-col xs:flex-row gap-1.5" role="group" aria-label="Filter by documentation requirement">
          {(["all", "none", "id_only"] as DocFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setDocFilter(f)}
              aria-pressed={docFilter === f}
              className={cn(
                "flex-1 py-2.5 xs:py-1 rounded font-mono text-[9px] xs:text-[7px] font-bold tracking-[0.08em] border transition-all",
                docFilter === f
                  ? "bg-accent border-accent text-white"
                  : "bg-transparent border-border text-content-muted hover:border-border-active hover:text-content-secondary"
              )}
            >
              {t(DOC_FILTER_KEY[f])}
            </button>
          ))}
        </div>
      </div>

      {/* Resource count */}
      {!isLoading && filteredResources.length > 0 && (
        <div className="px-4 pt-3 pb-0 flex-shrink-0">
          <div className="font-mono text-[9px] text-content-muted tracking-[0.1em]" aria-live="polite">
            {filteredResources.length} {filteredResources.length !== 1 ? t("RESULT_S") : t("RESULT_1")}
          </div>
        </div>
      )}

      {/* Resource list */}
      <div
        className="flex-1 overflow-y-auto p-3 flex flex-col gap-2"
        role="list"
        aria-label={`${filteredResources.length} resources found`}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-content-muted" aria-live="polite">
            <div className="font-mono text-[11px] tracking-[0.1em] animate-pulse">{t("LOADING")}</div>
          </div>
        ) : filteredResources.length > 0 ? (
          filteredResources.map(r => (
            <div
              key={r.id}
              role="listitem"
              ref={el => { if (el) cardRefs.current.set(r.id, el); else cardRefs.current.delete(r.id); }}
            >
              <ResourceCard
                resource={r}
                selected={selectedResourceId === r.id}
                onClick={onSelectResource ? () => onSelectResource(r.id) : undefined}
              />
            </div>
          ))
        ) : totalCount > 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-content-muted px-4">
            <div className="text-3xl mb-1" aria-hidden="true">⊕</div>
            <div className="font-mono text-[11px] tracking-[0.08em] text-center">
              {t("ZOOM_OUT")} {totalCount} {totalCount !== 1 ? t("RESULT_S") : t("RESULT_1")}
            </div>
            <div className="font-mono text-[9px] text-content-tertiary tracking-[0.06em] text-center">
              {totalCount} {t("OUTSIDE_VIEW")}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-content-muted px-4">
            <div className="text-3xl mb-1" aria-hidden="true">◎</div>
            <div className="font-mono text-[11px] tracking-[0.08em]">{t("NO_RESOURCES")}</div>
            <div className="w-full border-t border-border pt-3 flex flex-col gap-1.5">
              <div className="font-mono text-[8px] text-content-tertiary tracking-[0.1em] mb-1">TRY SEARCHING FOR</div>
              {["emergency shelter", "free food bank", "legal aid", "medical clinic", "language interpreter"].map(ex => (
                <button
                  key={ex}
                  onClick={() => onSearch(ex)}
                  className="text-left font-mono text-[10px] text-accent hover:text-accent-hover tracking-[0.06em] py-0.5 transition-colors"
                >
                  → {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Crisis footer */}
      <div
        className="mx-3 mb-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5 flex-shrink-0"
        role="complementary"
        aria-label="Crisis support contacts"
      >
        <div className="font-mono text-[10px] md:text-[8px] font-bold text-content-tertiary tracking-[0.12em] mb-1.5">{t("CRISIS_SUPPORT")}</div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[11px] md:text-[9px] text-content-secondary tracking-[0.06em]">{t("EMERGENCY_SVCS")}</span>
          <a
            href="tel:911"
            className="font-mono text-[13px] md:text-[11px] font-bold text-red-400 hover:text-red-300 transition-colors"
            aria-label="Call 911 — emergency services"
          >
            911
          </a>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] md:text-[9px] text-content-secondary tracking-[0.06em]">{t("REFUGEE_HOTLINE")}</span>
          <a
            href="tel:18003540365"
            className="font-mono text-[12px] md:text-[10px] font-semibold text-content-secondary hover:text-content-primary transition-colors"
            aria-label="Call refugee hotline 1-800-354-0365"
          >
            1-800-354-0365
          </a>
        </div>
      </div>
    </section>
  );
}
