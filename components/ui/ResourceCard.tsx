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
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(`${r.address} ${r.city} ${r.state}`)}`;

  return (
    <article
      className={cn(
        "border rounded-lg bg-[#111] p-3.5 transition-all group",
        r.urgent ? "border-l-[3px] border-l-red-500 border-white/[0.08]" : "border-white/[0.08]",
        "hover:border-white/15 hover:bg-[#1a1a1a]"
      )}
      aria-label={`${r.name}${r.urgent ? " — urgent" : ""}`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 min-w-0">
          <div
            className="font-mono text-[8px] font-semibold text-[#444] tracking-[0.12em] mb-0.5"
            aria-hidden="true"
          >
            {cat.label}
          </div>
          <h3 className="font-sans text-[14px] font-semibold text-white leading-tight truncate">
            {r.name}
          </h3>
        </div>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px] ml-2 flex-shrink-0"
          style={{ background: cat.bg, color: cat.color }}
          aria-hidden="true"
        >
          {cat.icon}
        </div>
      </div>

      {/* Status */}
      <div className="mb-2.5 flex items-center gap-1.5 flex-wrap">
        <StatusBadge status={r.status} />
        {r.urgent && (
          <span className="inline-block font-mono text-[8px] font-bold tracking-[0.1em] px-2 py-0.5 rounded text-red-400 bg-red-500/10 border border-red-500/20">
            URGENT
          </span>
        )}
      </div>

      {/* Details */}
      {!compact && (
        <dl className="space-y-1.5 mb-3">
          <div className="flex items-start gap-2 font-mono text-[10px] text-[#888]">
            <dt className="text-[#444] mt-px flex-shrink-0" aria-hidden="true">⊙</dt>
            <dd className="leading-tight">
              <address className="not-italic">{r.address}, {r.city}, {r.state}</address>
            </dd>
          </div>
          {r.phone && (
            <div className="flex items-center gap-2 font-mono text-[10px] text-[#888]">
              <dt className="text-[#444]" aria-hidden="true">☎</dt>
              <dd>
                <a
                  href={`tel:${r.phone.replace(/\D/g, "")}`}
                  className="hover:text-white transition-colors"
                  aria-label={`Call ${r.name}: ${r.phone}`}
                >
                  {r.phone}
                </a>
              </dd>
            </div>
          )}
          {r.hours && Object.keys(r.hours).length > 0 && (
            <div className="flex items-start gap-2 font-mono text-[10px] text-[#888]">
              <dt className="text-[#444] mt-px" aria-hidden="true">◷</dt>
              <dd className="leading-snug">
                {Object.entries(r.hours)
                  .filter(([, h]) => h)
                  .map(([d, h]) => `${d}: ${h}`)
                  .join(" · ")}
              </dd>
            </div>
          )}
          {r.languages && r.languages.length > 0 && (
            <div className="flex items-center gap-2 font-mono text-[10px] text-[#888]">
              <dt className="text-[#444]" aria-hidden="true">◈</dt>
              <dd aria-label={`Languages: ${r.languages.join(", ")}`}>
                {r.languages.join(", ")}
              </dd>
            </div>
          )}
        </dl>
      )}

      {/* CTA */}
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full py-2 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] font-mono text-[10px] font-bold tracking-[0.1em] text-white text-center transition-all"
        aria-label={`Get directions to ${r.name}`}
      >
        GET DIRECTIONS
      </a>
    </article>
  );
}
