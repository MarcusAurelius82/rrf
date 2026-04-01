"use client";
import { useState, useRef, useEffect } from "react";
import { Resource } from "@/types";
import { ResourceCard } from "@/components/ui/ResourceCard";
import { SearchInput } from "@/components/ui/SearchInput";
import { cn } from "@/lib/utils";

type DocFilter = "all" | "none" | "id_only";

const DOC_FILTER_LABELS: Record<DocFilter, string> = {
  all:     "ALL RESOURCES",
  none:    "NO DOCS REQUIRED",
  id_only: "ID ONLY",
};

interface ResourcePanelProps {
  resources: Resource[];
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
  selectedState,
  isLoading,
  aiSummary,
  onSearch,
  searchQuery,
  onSearchChange,
  onClose,
  selectedResourceId,
  onSelectResource,
}: ResourcePanelProps) {
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
              LOCAL RESOURCES{selectedState ? ` — ${selectedState}` : ""}
            </div>
            {urgentCount > 0 && (
              <span className="font-mono text-[9px] md:text-[8px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
                {urgentCount} URGENT
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
          aiEnabled
          placeholder="Search resources… (AI-powered)"
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
              {DOC_FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div
          className="mx-3 mt-3 px-3 py-2.5 rounded-lg bg-accent-dim border border-accent-border flex-shrink-0"
          role="status"
          aria-label="AI search summary"
          aria-live="polite"
        >
          <div className="font-mono text-[8px] font-bold text-accent tracking-[0.12em] mb-1" aria-hidden="true">
            AI SUMMARY
          </div>
          <p className="font-sans text-[11px] text-content-secondary leading-relaxed">{aiSummary}</p>
        </div>
      )}

      {/* Resource count */}
      {!isLoading && filteredResources.length > 0 && (
        <div className="px-4 pt-3 pb-0 flex-shrink-0">
          <div className="font-mono text-[9px] text-content-muted tracking-[0.1em]" aria-live="polite">
            {filteredResources.length} RESULT{filteredResources.length !== 1 ? "S" : ""}
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
            <div className="font-mono text-[11px] tracking-[0.1em] animate-pulse">LOADING...</div>
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
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-content-muted">
            <div className="text-3xl mb-1" aria-hidden="true">◎</div>
            <div className="font-mono text-[11px] tracking-[0.08em]">NO RESOURCES FOUND</div>
            <div className="font-mono text-[9px] text-content-faint">SELECT A STATE ON THE MAP</div>
          </div>
        )}
      </div>

      {/* Crisis footer */}
      <div
        className="mx-3 mb-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5 flex-shrink-0"
        role="complementary"
        aria-label="Crisis support contacts"
      >
        <div className="font-mono text-[10px] md:text-[8px] font-bold text-content-tertiary tracking-[0.12em] mb-1.5">CRISIS SUPPORT</div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[11px] md:text-[9px] text-content-secondary tracking-[0.06em]">EMERGENCY SERVICES</span>
          <a
            href="tel:911"
            className="font-mono text-[13px] md:text-[11px] font-bold text-red-400 hover:text-red-300 transition-colors"
            aria-label="Call 911 — emergency services"
          >
            911
          </a>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] md:text-[9px] text-content-secondary tracking-[0.06em]">REFUGEE HOTLINE</span>
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
