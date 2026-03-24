"use client";
import { cn } from "@/lib/utils";
import { CATEGORY_CONFIG } from "@/lib/utils";
import { ResourceCategory } from "@/types";

interface SidebarProps {
  activeCategory: ResourceCategory | null;
  onCategoryChange: (cat: ResourceCategory | null) => void;
  categoryCounts: Record<string, number>;
  onReportMissing: () => void;
}

export function Sidebar({ activeCategory, onCategoryChange, categoryCounts, onReportMissing }: SidebarProps) {
  return (
    <aside className="w-[220px] flex-shrink-0 border-r border-white/[0.08] bg-[#0a0a0a] flex flex-col py-4 overflow-y-auto">
      <div className="px-3.5 pb-4">
        <div className="font-mono text-[9px] font-semibold text-[#444] tracking-[0.12em] mb-1">RESOURCES</div>
        <div className="font-mono text-[11px] font-semibold text-[#666] tracking-[0.06em] mb-3">FILTER_BY_TYPE</div>

        {(Object.keys(CATEGORY_CONFIG) as ResourceCategory[]).map(cat => {
          const { label, icon, color, bg } = CATEGORY_CONFIG[cat];
          const count = categoryCounts[cat] || 0;
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => onCategoryChange(isActive ? null : cat)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md mb-0.5 border transition-all",
                isActive
                  ? "bg-[#1a1a1a] border-white/10"
                  : "bg-transparent border-transparent hover:bg-[#111]"
              )}
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] flex-shrink-0"
                style={{ background: bg, color }}
              >
                {icon}
              </div>
              <span
                className="font-mono text-[10px] font-semibold tracking-[0.08em] flex-1 text-left"
                style={{ color: isActive ? color : "#888" }}
              >
                {label}
              </span>
              <span className="font-mono text-[9px] text-[#555] bg-[#111] px-1.5 py-0.5 rounded-full border border-white/[0.06]">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="h-px bg-white/[0.06] mx-3.5 my-1" />

      <div className="px-3.5 mt-3">
        <button
          onClick={onReportMissing}
          className="w-full text-left font-mono text-[10px] font-medium text-[#666] px-2.5 py-2 rounded-md border border-white/[0.08] hover:border-white/15 hover:text-white hover:bg-[#1a1a1a] transition-all"
        >
          + Report Missing Resource
        </button>
      </div>

      <div className="mt-auto pt-4 px-3.5">
        {["⊙  SUPPORT", "?  FAQ"].map(item => (
          <button
            key={item}
            className="w-full text-left font-mono text-[10px] text-[#444] px-1 py-1.5 hover:text-[#888] transition-colors tracking-[0.06em]"
          >
            {item}
          </button>
        ))}
      </div>
    </aside>
  );
}
