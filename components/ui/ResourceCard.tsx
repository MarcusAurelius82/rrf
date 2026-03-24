"use client";
import { Resource } from "@/types";
import { CATEGORY_CONFIG } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";

interface ResourceCardProps {
  resource: Resource;
  compact?: boolean;
}

export function ResourceCard({ resource: r, compact }: ResourceCardProps) {
  const cat = CATEGORY_CONFIG[r.category];

  return (
    <div
      className={cn(
        "border rounded-lg bg-[#111] p-3.5 transition-all cursor-pointer group",
        r.urgent ? "border-l-[3px] border-l-red-500 border-white/[0.08]" : "border-white/[0.08]",
        "hover:border-white/15 hover:bg-[#1a1a1a]"
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[8px] font-semibold text-[#444] tracking-[0.12em] mb-0.5">
            {cat.label}
          </div>
          <div className="font-sans text-[14px] font-semibold text-white leading-tight truncate">
            {r.name}
          </div>
        </div>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px] ml-2 flex-shrink-0"
          style={{ background: cat.bg, color: cat.color }}
        >
          {cat.icon}
        </div>
      </div>

      {/* Status */}
      <div className="mb-2.5">
        <StatusBadge status={r.status} />
        {r.urgent && (
          <span className="ml-1.5 inline-block font-mono text-[8px] font-bold tracking-[0.1em] px-2 py-0.5 rounded text-red-400 bg-red-500/10 border border-red-500/20">
            URGENT
          </span>
        )}
      </div>

      {/* Details */}
      {!compact && (
        <div className="space-y-1.5 mb-3">
          <div className="flex items-start gap-2 font-mono text-[10px] text-[#888]">
            <span className="text-[#444] mt-px flex-shrink-0">⊙</span>
            <span className="leading-tight">{r.address}, {r.city}, {r.state}</span>
          </div>
          {r.phone && (
            <div className="flex items-center gap-2 font-mono text-[10px] text-[#888]">
              <span className="text-[#444]">☎</span>
              <a href={`tel:${r.phone}`} className="hover:text-white transition-colors">{r.phone}</a>
            </div>
          )}
          {r.hours && (
            <div className="flex items-start gap-2 font-mono text-[10px] text-[#888]">
              <span className="text-[#444] mt-px">◷</span>
              <span>{Object.entries(r.hours).map(([d, h]) => h ? `${d}: ${h}` : null).filter(Boolean).join(" · ")}</span>
            </div>
          )}
          {r.languages && r.languages.length > 0 && (
            <div className="flex items-center gap-2 font-mono text-[10px] text-[#888]">
              <span className="text-[#444]">◈</span>
              <span>{r.languages.join(", ")}</span>
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(r.address + " " + r.city + " " + r.state)}`, "_blank")}
        className="w-full py-2 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] font-mono text-[10px] font-bold tracking-[0.1em] text-white transition-all"
      >
        GET DIRECTIONS
      </button>
    </div>
  );
}
