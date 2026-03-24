"use client";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/ui/Navbar";
import { ResourceCard } from "@/components/ui/ResourceCard";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterBar } from "@/components/ui/FilterBar";
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
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedState, activeCategory]);

  function handleStateChange(code: string) {
    setSelectedState(code);
    router.push(`/directory/${code}`, { scroll: false });
  }

  const filtered = resources.filter(r =>
    !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Count per category for FilterBar badges
  const categoryCounts = Object.fromEntries(
    (Object.keys(CATEGORY_CONFIG) as ResourceCategory[]).map(cat => [
      cat,
      resources.filter(r => r.category === cat).length,
    ])
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 md:p-6">
          {/* Page header */}
          <div className="mb-5">
            <div className="font-mono text-[9px] text-[#444] tracking-[0.12em] mb-1">BROWSE</div>
            <h1 className="font-mono text-xl font-bold text-white tracking-[0.04em]">DIRECTORY</h1>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5 flex-wrap">
            <label className="sr-only" htmlFor="state-select">Select state</label>
            <select
              id="state-select"
              value={selectedState}
              onChange={e => handleStateChange(e.target.value)}
              className="font-mono text-[11px] bg-[#111] border border-white/[0.08] rounded-md px-3 py-2 text-white outline-none hover:border-white/15 focus:border-white/20 transition-all flex-shrink-0"
              aria-label="Select state"
            >
              {STATE_CODES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <FilterBar
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              categoryCounts={categoryCounts}
            />

            <div className="flex-1 min-w-[200px] w-full sm:w-auto">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search resources…"
                aiEnabled
              />
            </div>
          </div>

          <div
            className="font-mono text-[9px] text-[#444] tracking-[0.12em] mb-3"
            aria-live="polite"
            aria-atomic="true"
          >
            {filtered.length} RESOURCE{filtered.length !== 1 ? "S" : ""} — {selectedState}
          </div>

          {loading ? (
            <div className="font-mono text-[#444] text-sm animate-pulse tracking-[0.1em]">LOADING...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#444]">
              <div className="text-4xl" aria-hidden="true">◎</div>
              <div className="font-mono text-[11px] tracking-[0.08em]">NO RESOURCES FOUND</div>
              <div className="font-mono text-[9px] text-[#333]">TRY A DIFFERENT STATE OR CATEGORY</div>
            </div>
          ) : (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              role="list"
              aria-label={`${filtered.length} resources in ${selectedState}`}
            >
              {filtered.map(r => (
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
