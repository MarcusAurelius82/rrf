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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(r => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(({ data }) => setStats(data))
      .catch(() => {
        // Fallback to mock data if endpoint not available
        setStats({
          total: 247,
          by_category: { shelter: 68, food: 54, legal: 49, medical: 43, language: 33 },
          by_state: { CA: 31, NY: 22, TX: 18, IL: 14, FL: 12 },
          urgent: 38,
          verified: 201,
        });
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const maxStateCount = stats
    ? Math.max(...Object.values(stats.by_state), 1)
    : 1;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-[9px] text-[#444] tracking-[0.12em] mb-1">OVERVIEW</div>
          <div className="flex items-center gap-3 mb-6">
            <h1 className="font-mono text-2xl font-bold text-white tracking-[0.04em]">DASHBOARD</h1>
            {error && (
              <span className="font-mono text-[9px] text-[#555] bg-[#111] border border-white/[0.08] px-2 py-1 rounded-full tracking-[0.08em]">
                DEMO DATA
              </span>
            )}
          </div>

          {loading ? (
            <div className="font-mono text-[11px] text-[#444] animate-pulse tracking-[0.1em]">LOADING...</div>
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "TOTAL RESOURCES", value: stats?.total ?? 0, color: "#fff" },
                  { label: "URGENT", value: stats?.urgent ?? 0, color: "#ef4444" },
                  { label: "VERIFIED", value: stats?.verified ?? 0, color: "#22c55e" },
                  { label: "PENDING REVIEW", value: (stats?.total ?? 0) - (stats?.verified ?? 0), color: "#f59e0b" },
                ].map(s => (
                  <div
                    key={s.label}
                    className="bg-[#111] border border-white/[0.08] rounded-lg p-4"
                    aria-label={`${s.label}: ${s.value}`}
                  >
                    <div className="font-mono text-[8px] text-[#444] tracking-[0.12em] mb-2">{s.label}</div>
                    <div className="font-mono text-3xl font-bold" style={{ color: s.color }}>
                      {s.value.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* By category */}
                <div className="bg-[#111] border border-white/[0.08] rounded-lg p-4">
                  <div className="font-mono text-[9px] text-[#444] tracking-[0.12em] mb-4">BY CATEGORY</div>
                  <div className="space-y-3" role="list" aria-label="Resources by category">
                    {stats && Object.entries(stats.by_category).map(([cat, count]) => {
                      const config = CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG];
                      const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                      return (
                        <div key={cat} role="listitem">
                          <div className="flex justify-between font-mono text-[10px] mb-1">
                            <span style={{ color: config?.color }}>{config?.label}</span>
                            <span className="text-[#888]">{count}</span>
                          </div>
                          <div
                            className="h-1 bg-[#222] rounded-full overflow-hidden"
                            role="progressbar"
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${config?.label}: ${pct}%`}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: config?.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* By state */}
                <div className="bg-[#111] border border-white/[0.08] rounded-lg p-4">
                  <div className="font-mono text-[9px] text-[#444] tracking-[0.12em] mb-4">TOP STATES</div>
                  <div className="space-y-2" role="list" aria-label="Resources by state">
                    {stats && Object.entries(stats.by_state)
                      .sort(([, a], [, b]) => b - a)
                      .map(([state, count]) => {
                        const pct = Math.round((count / maxStateCount) * 100);
                        return (
                          <div key={state} className="flex justify-between items-center font-mono text-[11px]" role="listitem">
                            <span className="text-[#888] w-8">{state}</span>
                            <div className="flex items-center gap-2 flex-1 ml-3">
                              <div
                                className="flex-1 h-1 bg-[#222] rounded-full overflow-hidden"
                                role="progressbar"
                                aria-valuenow={pct}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`${state}: ${count} resources`}
                              >
                                <div
                                  className="h-full bg-[#2563eb] rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[#555] w-6 text-right">{count}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
