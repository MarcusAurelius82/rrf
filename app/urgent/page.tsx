"use client";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/ui/Navbar";
import { ResourceCard } from "@/components/ui/ResourceCard";
import { Resource } from "@/types";

export default function UrgentPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/resources?urgent_only=true")
      .then(r => r.json())
      .then(({ data }) => setResources(data || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {/* Crisis banner */}
          <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/5">
            <div className="font-mono text-[10px] font-bold text-red-400 tracking-[0.12em] mb-1">⚠ CRISIS LINE</div>
            <div className="flex items-center justify-between">
              <span className="font-sans text-sm text-white">If you are in immediate danger call 911</span>
              <span className="font-mono text-xl font-bold text-red-400">911</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="font-sans text-sm text-[#888]">National Refugee Hotline</span>
              <span className="font-mono text-sm font-semibold text-[#888]">1-800-354-0365</span>
            </div>
          </div>

          <div className="font-mono text-[9px] text-[#444] tracking-[0.12em] mb-3">
            URGENT RESOURCES — {resources.length} FOUND
          </div>

          {loading ? (
            <div className="font-mono text-[#444] text-sm animate-pulse">LOADING...</div>
          ) : (
            <div className="grid gap-3">
              {resources.map(r => <ResourceCard key={r.id} resource={r} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
