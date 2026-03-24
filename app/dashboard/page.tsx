"use client";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/ui/Navbar";
import { CATEGORY_CONFIG } from "@/lib/utils";

interface Stats {
  total: number;
  by_category: Record<string, number>;
  by_state: Record<string, number>;
  urgent: number;
  verified: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    // In production, this would call /api/admin/stats
    // Mock stats for now
    setStats({
      total: 247,
      by_category: { shelter: 68, food: 54, legal: 49, medical: 43, language: 33 },
      by_state: { NY: 22, CA: 31, TX: 18, IL: 14, FL: 12 },
      urgent: 38,
      verified: 201,
    });
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-[9px] text-[#444] tracking-[0.12em] mb-1">OVERVIEW</div>
          <h1 className="font-mono text-2xl font-bold text-white mb-6 tracking-[0.04em]">DASHBOARD</h1>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: "TOTAL RESOURCES", value: stats?.total || 0, color: "#fff" },
              { label: "URGENT", value: stats?.urgent || 0, color: "#ef4444" },
              { label: "VERIFIED", value: stats?.verified || 0, color: "#22c55e" },
              { label: "PENDING REVIEW", value: (stats?.total || 0) - (stats?.verified || 0), color: "#f59e0b" },
            ].map(s => (
              <div key={s.label} className="bg-[#111] border border-white/[0.08] rounded-lg p-4">
                <div className="font-mono text-[8px] text-[#444] tracking-[0.12em] mb-2">{s.label}</div>
                <div className="font-mono text-3xl font-bold" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* By category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#111] border border-white/[0.08] rounded-lg p-4">
              <div className="font-mono text-[9px] text-[#444] tracking-[0.12em] mb-4">BY CATEGORY</div>
              <div className="space-y-3">
                {stats && Object.entries(stats.by_category).map(([cat, count]) => {
                  const config = CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG];
                  const pct = Math.round((count / stats.total) * 100);
                  return (
                    <div key={cat}>
                      <div className="flex justify-between font-mono text-[10px] mb-1">
                        <span style={{ color: config?.color }}>{config?.label}</span>
                        <span className="text-[#888]">{count}</span>
                      </div>
                      <div className="h-1 bg-[#222] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: config?.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#111] border border-white/[0.08] rounded-lg p-4">
              <div className="font-mono text-[9px] text-[#444] tracking-[0.12em] mb-4">TOP STATES</div>
              <div className="space-y-2">
                {stats && Object.entries(stats.by_state)
                  .sort(([,a],[,b]) => b - a)
                  .map(([state, count]) => (
                    <div key={state} className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-[#888]">{state}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1 bg-[#222] rounded-full overflow-hidden">
                          <div className="h-full bg-[#2563eb] rounded-full" style={{ width: `${(count / 31) * 100}%` }} />
                        </div>
                        <span className="text-[#555] w-6 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
