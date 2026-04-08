"use client";
import { DocumentationRequired, Resource } from "@/types";
import { CATEGORY_CONFIG } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

function formatHours(hours: Record<string, string>): string {
  const entries = Object.entries(hours).filter(([, h]) => h && h.trim());
  if (!entries.length) return "";
  const uniqueTimes = [...new Set(entries.map(([, h]) => h))];
  const dayKeys = entries.map(([d]) => d.toLowerCase().slice(0, 3));

  if (uniqueTimes.length === 1) {
    const weekdays = new Set(["mon", "tue", "wed", "thu", "fri"]);
    const allWeekdays =
      entries.length === 5 &&
      dayKeys.every(d => weekdays.has(d)) &&
      dayKeys.every(d => d !== "sat" && d !== "sun");
    if (allWeekdays) return `MON–FRI  ${uniqueTimes[0]}`;
    if (entries.length <= 3)
      return `${dayKeys.map(d => d.toUpperCase()).join(", ")}  ${uniqueTimes[0]}`;
    return `${dayKeys.slice(0, 2).map(d => d.toUpperCase()).join(", ")} +${entries.length - 2}  ${uniqueTimes[0]}`;
  }

  const shown = entries
    .slice(0, 2)
    .map(([d, h]) => `${d.slice(0, 3).toUpperCase()}: ${h}`)
    .join("  ·  ");
  return entries.length > 2 ? `${shown}  +${entries.length - 2}` : shown;
}

const DOC_BADGE: Record<DocumentationRequired, { label: string; className: string }> = {
  none:              { label: "NO DOCS REQUIRED",           className: "text-green-400 bg-green-500/10 border-green-500/20" },
  id_only:           { label: "ID ONLY",                    className: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  legal_status:      { label: "LEGAL STATUS REQUIRED",      className: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  benefits_eligible: { label: "PROGRAM ELIGIBILITY REQUIRED", className: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  unknown:           { label: "⚠ CALL AHEAD — CONFIRM ELIGIBILITY", className: "text-content-muted bg-border/30 border-border" },
};

interface ResourceCardProps {
  resource: Resource;
  compact?: boolean;
  selected?: boolean;
  onClick?: () => void;
  lang?: string;
}

export function ResourceCard({ resource: r, compact, selected, onClick, lang = "EN" }: ResourceCardProps) {
  const cat = CATEGORY_CONFIG[r.category];
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(`${r.address} ${r.city} ${r.state}`)}`;

  // Translate the content a user needs to navigate to and use the resource
  const sourceTexts = [
    r.name,
    compact ? `${r.city}, ${r.state}` : `${r.address}, ${r.city}, ${r.state}`,
    r.documentation_required ? (DOC_BADGE[r.documentation_required]?.label ?? "") : "",
  ];
  const [tName, tAddress, tDocLabel] = useTranslation(sourceTexts, lang);

  return (
    <article
      className={cn(
        "border rounded-lg bg-surface-1 p-3.5 transition-all group",
        r.urgent ? "border-l-[3px] border-l-red-500 border-border" : "border-border",
        selected
          ? "border-accent bg-surface-2 ring-1 ring-accent/30"
          : "hover:border-border-active hover:bg-surface-2",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
      aria-label={`${r.name}${r.urgent ? " — urgent" : ""}${selected ? " — selected" : ""}`}
      aria-selected={selected}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 min-w-0">
          <div
            className="font-mono text-[9px] md:text-[8px] font-semibold text-content-muted tracking-[0.12em] mb-0.5"
            aria-hidden="true"
          >
            {cat.label}
          </div>
          <h3 className={cn(
            "font-sans text-[14px] font-semibold text-content-primary leading-tight",
            compact ? "truncate" : "line-clamp-2"
          )}>
            {tName}
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
          <span className="inline-block font-mono text-[9px] md:text-[8px] font-bold tracking-[0.1em] px-2 py-0.5 rounded text-red-400 bg-red-500/10 border border-red-500/20">
            URGENT
          </span>
        )}
        {r.documentation_required && DOC_BADGE[r.documentation_required] && (
          <span className={cn(
            "inline-block font-mono text-[9px] md:text-[8px] font-bold tracking-[0.1em] px-2 py-0.5 rounded border",
            DOC_BADGE[r.documentation_required].className
          )}>
            {tDocLabel || DOC_BADGE[r.documentation_required].label}
          </span>
        )}
      </div>

      {/* Details */}
      <dl className="space-y-1.5 mb-3">
        <div className="flex items-start gap-2 font-mono text-[11px] md:text-[10px] text-content-secondary">
          <dt className="text-content-muted mt-px flex-shrink-0" aria-hidden="true">⊙</dt>
          <dd className="leading-tight">
            <address className="not-italic">{tAddress}</address>
          </dd>
        </div>
        {r.phone && (
          <div className="flex items-center gap-2 font-mono text-[10px] text-content-secondary">
            <dt className="text-content-muted" aria-hidden="true">☎</dt>
            <dd>
              <a
                href={`tel:${r.phone.replace(/\D/g, "")}`}
                className="hover:text-content-primary transition-colors"
                aria-label={`Call ${r.name}: ${r.phone}`}
                onClick={e => e.stopPropagation()}
              >
                {r.phone}
              </a>
            </dd>
          </div>
        )}
        {!compact && r.hours && Object.keys(r.hours).length > 0 && (
          <div className="flex items-start gap-2 font-mono text-[11px] md:text-[10px] text-content-secondary">
            <dt className="text-content-muted mt-px flex-shrink-0" aria-hidden="true">◷</dt>
            <dd className="leading-snug">{formatHours(r.hours)}</dd>
          </div>
        )}
        {!compact && r.languages && r.languages.length > 0 && (
          <div className="flex items-center gap-2 font-mono text-[10px] text-content-secondary">
            <dt className="text-content-muted" aria-hidden="true">◈</dt>
            <dd aria-label={`Languages: ${r.languages.join(", ")}`}>
              {r.languages.join(", ")}
            </dd>
          </div>
        )}
      </dl>

      {/* CTA */}
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full py-3 md:py-2 rounded-md bg-accent hover:bg-accent-hover font-mono text-[10px] font-bold tracking-[0.1em] text-white text-center transition-all"
        aria-label={`Get directions to ${r.name}`}
      >
        GET DIRECTIONS
      </a>
    </article>
  );
}
