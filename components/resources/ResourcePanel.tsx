"use client";
import { Resource, ResourceCategory } from "@/types";
import { ResourceCard } from "@/components/ui/ResourceCard";
import { SearchInput } from "@/components/ui/SearchInput";
import { useState } from "react";

interface ResourcePanelProps {
  resources: Resource[];
  selectedState: string | null;
  isLoading?: boolean;
  aiSummary?: string;
  onSearch: (query: string) => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
}

export function ResourcePanel({
  resources, selectedState, isLoading, aiSummary, onSearch, searchQuery, onSearchChange
}: ResourcePanelProps) {
  return (
    <div className="w-[340px] flex-shrink-0 border-l border-white/[0.08] bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-white/[0.08] flex-shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <div className="font-mono text-[9px] font-semibold text-[#444] tracking-[0.12em]">
            LOCAL RESOURCES{selectedState ? ` — ${selectedState}` : ""}
          </div>
          <div className="font-mono text-[9px] text-[#444] tracking-[0.08em]">
            SORT: DISTANCE
          </div>
        </div>
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          onSearch={onSearch}
          aiEnabled
          placeholder="Search resources... (AI-powered)"
        />
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="mx-3 mt-3 px-3 py-2.5 rounded-lg bg-[#2563eb]/10 border border-[#2563eb]/20 flex-shrink-0">
          <div className="font-mono text-[8px] font-bold text-[#2563eb] tracking-[0.12em] mb-1">AI SUMMARY</div>
          <p className="font-sans text-[11px] text-[#aaa] leading-relaxed">{aiSummary}</p>
        </div>
      )}

      {/* Resource list */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-[#444]">
            <div className="font-mono text-[11px] tracking-[0.1em] animate-pulse">LOADING...</div>
          </div>
        ) : resources.length > 0 ? (
          resources.map(r => <ResourceCard key={r.id} resource={r} />)
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-[#444]">
            <div className="text-3xl mb-1">◎</div>
            <div className="font-mono text-[11px] tracking-[0.08em]">NO RESOURCES FOUND</div>
            <div className="font-mono text-[9px] text-[#333]">SELECT A STATE ON THE MAP</div>
          </div>
        )}
      </div>

      {/* Crisis footer */}
      <div className="mx-3 mb-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5 flex-shrink-0">
        <div className="font-mono text-[8px] font-bold text-[#444] tracking-[0.12em] mb-1.5">CRISIS SUPPORT</div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[9px] text-[#888] tracking-[0.06em]">EMERGENCY SERVICES</span>
          <span className="font-mono text-[11px] font-bold text-red-400">911</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] text-[#888] tracking-[0.06em]">REFUGEE HOTLINE</span>
          <span className="font-mono text-[10px] font-semibold text-[#888]">1-800-354-0365</span>
        </div>
      </div>
    </div>
  );
}
