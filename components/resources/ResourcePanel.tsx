"use client";
import { Resource } from "@/types";
import { ResourceCard } from "@/components/ui/ResourceCard";
import { SearchInput } from "@/components/ui/SearchInput";

interface ResourcePanelProps {
  resources: Resource[];
  selectedState: string | null;
  isLoading?: boolean;
  aiSummary?: string;
  onSearch: (query: string) => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onClose?: () => void;
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
}: ResourcePanelProps) {
  const urgentCount = resources.filter(r => r.urgent).length;

  return (
    <section
      className="w-[340px] flex-shrink-0 border-l border-white/[0.08] bg-[#0a0a0a] flex flex-col overflow-hidden h-full"
      aria-label="Resource list"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-white/[0.08] flex-shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="font-mono text-[9px] font-semibold text-[#444] tracking-[0.12em]">
              LOCAL RESOURCES{selectedState ? ` — ${selectedState}` : ""}
            </div>
            {urgentCount > 0 && (
              <span className="font-mono text-[8px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
                {urgentCount} URGENT
              </span>
            )}
          </div>
          {/* Mobile close button */}
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close resource panel"
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#555] hover:text-white hover:bg-white/[0.08] transition-all text-[12px] md:hidden"
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
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div
          className="mx-3 mt-3 px-3 py-2.5 rounded-lg bg-[#2563eb]/10 border border-[#2563eb]/20 flex-shrink-0"
          role="status"
          aria-label="AI search summary"
          aria-live="polite"
        >
          <div className="font-mono text-[8px] font-bold text-[#2563eb] tracking-[0.12em] mb-1" aria-hidden="true">
            AI SUMMARY
          </div>
          <p className="font-sans text-[11px] text-[#aaa] leading-relaxed">{aiSummary}</p>
        </div>
      )}

      {/* Resource count */}
      {!isLoading && resources.length > 0 && (
        <div className="px-4 pt-3 pb-0 flex-shrink-0">
          <div className="font-mono text-[9px] text-[#444] tracking-[0.1em]" aria-live="polite">
            {resources.length} RESULT{resources.length !== 1 ? "S" : ""}
          </div>
        </div>
      )}

      {/* Resource list */}
      <div
        className="flex-1 overflow-y-auto p-3 flex flex-col gap-2"
        role="list"
        aria-label={`${resources.length} resources found`}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-[#444]" aria-live="polite">
            <div className="font-mono text-[11px] tracking-[0.1em] animate-pulse">LOADING...</div>
          </div>
        ) : resources.length > 0 ? (
          resources.map(r => (
            <div key={r.id} role="listitem">
              <ResourceCard resource={r} />
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-[#444]">
            <div className="text-3xl mb-1" aria-hidden="true">◎</div>
            <div className="font-mono text-[11px] tracking-[0.08em]">NO RESOURCES FOUND</div>
            <div className="font-mono text-[9px] text-[#333]">SELECT A STATE ON THE MAP</div>
          </div>
        )}
      </div>

      {/* Crisis footer */}
      <div
        className="mx-3 mb-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5 flex-shrink-0"
        role="complementary"
        aria-label="Crisis support contacts"
      >
        <div className="font-mono text-[8px] font-bold text-[#555] tracking-[0.12em] mb-1.5">CRISIS SUPPORT</div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[9px] text-[#888] tracking-[0.06em]">EMERGENCY SERVICES</span>
          <a
            href="tel:911"
            className="font-mono text-[11px] font-bold text-red-400 hover:text-red-300 transition-colors"
            aria-label="Call 911 — emergency services"
          >
            911
          </a>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] text-[#888] tracking-[0.06em]">REFUGEE HOTLINE</span>
          <a
            href="tel:18003540365"
            className="font-mono text-[10px] font-semibold text-[#888] hover:text-white transition-colors"
            aria-label="Call refugee hotline 1-800-354-0365"
          >
            1-800-354-0365
          </a>
        </div>
      </div>
    </section>
  );
}
