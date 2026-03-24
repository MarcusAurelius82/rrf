"use client";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/ui/Navbar";
import { ResourceCard } from "@/components/ui/ResourceCard";
import { SearchInput } from "@/components/ui/SearchInput";
import { Resource, ResourceCategory } from "@/types";
import { CATEGORY_CONFIG } from "@/lib/utils";
import { STATE_CODES } from "@/lib/states";
import { useRouter } from "next/navigation";

interface DirectoryClientProps {
  initialState: string;
}

export function DirectoryClient({ initialState }: DirectoryClientProps) {
  const router = useRouter();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedState, setSelectedState] = useState(initialState.toUpperCase());
  const [activeCategory, setActiveCategory] = useState<ResourceCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ state: selectedState });
    if (activeCategory) params.set("category", activeCategory);
    fetch(`/api/resources?${params}`)
      .then(r => r.json())
      .then(({ data }) => setResources(data || []))
      .finally(() => setLoading(false));
  }, [selectedState, activeCategory]);

  function handleStateChange(code: string) {
    setSelectedState(code);
    router.push(`/directory/${code}`, { scroll: false });
  }

  const filtered = resources.filter(r =>
    !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          {/* Filters */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <select
              value={selectedState}
              onChange={e => handleStateChange(e.target.value)}
              className="font-mono text-[11px] bg-[#111] border border-white/[0.08] rounded-md px-3 py-2 text-white outline-none hover:border-white/15 transition-all"
            >
              {STATE_CODES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(CATEGORY_CONFIG) as ResourceCategory[]).map(cat => {
                const { label, color, bg } = CATEGORY_CONFIG[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                    className="font-mono text-[9px] font-bold tracking-[0.08em] px-2.5 py-1.5 rounded-md border transition-all"
                    style={{
                      color: activeCategory === cat ? color : "#666",
                      background: activeCategory === cat ? bg : "transparent",
                      borderColor: activeCategory === cat ? color + "40" : "rgba(255,255,255,0.08)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex-1 min-w-[200px]">
              <SearchInput value={searchQuery} onChange={setSearchQuery} aiEnabled />
            </div>
          </div>

          <div className="font-mono text-[9px] text-[#444] tracking-[0.12em] mb-3">
            {filtered.length} RESOURCES — {selectedState}
          </div>

          {loading ? (
            <div className="font-mono text-[#444] text-sm animate-pulse">LOADING...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(r => <ResourceCard key={r.id} resource={r} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
