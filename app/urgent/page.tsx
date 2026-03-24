"use client";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/ui/Navbar";
import { ResourceCard } from "@/components/ui/ResourceCard";
import { Resource } from "@/types";

const CRISIS_LINES = [
  { label: "EMERGENCY SERVICES", number: "911", tel: "911", highlight: true },
  { label: "NATIONAL REFUGEE HOTLINE", number: "1-800-354-0365", tel: "18003540365", highlight: false },
  { label: "CRISIS TEXT LINE", number: "Text HOME to 741741", tel: null, highlight: false },
];

export default function UrgentPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/resources?urgent_only=true")
      .then(r => r.json())
      .then(({ data }) => setResources(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          {/* Page header */}
          <div className="mb-5">
            <div className="font-mono text-[9px] text-red-500/70 tracking-[0.12em] mb-1">CRITICAL</div>
            <h1 className="font-mono text-xl font-bold text-white tracking-[0.04em]">URGENT RESOURCES</h1>
          </div>

          {/* Crisis banner */}
          <section
            className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/5"
            aria-label="Crisis hotlines"
          >
            <div className="font-mono text-[10px] font-bold text-red-400 tracking-[0.12em] mb-3">
              ⚠ CRISIS LINES — AVAILABLE 24/7
            </div>
            <div className="space-y-2">
              {CRISIS_LINES.map(line => (
                <div key={line.label} className="flex items-center justify-between gap-4">
                  <span className="font-mono text-[9px] text-[#888] tracking-[0.06em] flex-1">
                    {line.label}
                  </span>
                  {line.tel ? (
                    <a
                      href={`tel:${line.tel}`}
                      className={`font-mono font-bold transition-colors ${
                        line.highlight
                          ? "text-xl text-red-400 hover:text-red-300"
                          : "text-sm text-[#888] hover:text-white"
                      }`}
                      aria-label={`Call ${line.label}: ${line.number}`}
                    >
                      {line.number}
                    </a>
                  ) : (
                    <span className="font-mono text-sm text-[#888]" aria-label={line.number}>
                      {line.number}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Results count */}
          <div
            className="font-mono text-[9px] text-[#444] tracking-[0.12em] mb-3"
            aria-live="polite"
          >
            {loading ? "LOADING..." : `${resources.length} URGENT RESOURCE${resources.length !== 1 ? "S" : ""} FOUND`}
          </div>

          {/* Resource list */}
          {loading ? (
            <div className="font-mono text-[#444] text-sm animate-pulse tracking-[0.1em]">LOADING...</div>
          ) : resources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#444]">
              <div className="text-3xl" aria-hidden="true">◎</div>
              <div className="font-mono text-[11px] tracking-[0.08em]">NO URGENT RESOURCES FOUND</div>
            </div>
          ) : (
            <div
              className="grid gap-3"
              role="list"
              aria-label={`${resources.length} urgent resources`}
            >
              {resources.map(r => (
                <div key={r.id} role="listitem">
                  <ResourceCard resource={r} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
