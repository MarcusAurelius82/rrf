"use client";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/ui/Navbar";
import { Sidebar } from "@/components/ui/Sidebar";
import { MapView } from "@/components/map/MapView";
import { ResourcePanel } from "@/components/resources/ResourcePanel";
import { Resource, ResourceCategory } from "@/types";
import { CATEGORY_CONFIG } from "@/lib/utils";

export default function MapPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [filteredResources, setFilteredResources] = useState<Resource[]>([]);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ResourceCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [aiSummary, setAiSummary] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState("EN");

  // Fetch resources when state changes
  useEffect(() => {
    if (!selectedState) return;
    setIsLoading(true);
    const params = new URLSearchParams({ state: selectedState });
    if (activeCategory) params.set("category", activeCategory);

    fetch(`/api/resources?${params}`)
      .then(r => r.json())
      .then(({ data }) => { setResources(data || []); setFilteredResources(data || []); })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [selectedState, activeCategory]);

  // Client-side filter
  useEffect(() => {
    let result = resources;
    if (activeCategory) result = result.filter(r => r.category === activeCategory);
    if (searchQuery && !aiSummary) {
      result = result.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredResources(result);
  }, [resources, activeCategory, searchQuery, aiSummary]);

  // AI search
  async function handleSearch(query: string) {
    if (!query.trim()) { setAiSummary(undefined); return; }
    setIsLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, state: selectedState, category: activeCategory }),
      });
      const { data } = await res.json();
      setFilteredResources(data?.resources || []);
      setAiSummary(data?.ai_summary);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  }

  // Category counts
  const categoryCounts = Object.fromEntries(
    Object.keys(CATEGORY_CONFIG).map(cat => [cat, resources.filter(r => r.category === cat).length])
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar
        currentLang={currentLang}
        onLanguageChange={setCurrentLang}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          categoryCounts={categoryCounts}
          onReportMissing={() => alert("Report Missing Resource — coming soon")}
        />
        <MapView
          resources={filteredResources}
          selectedState={selectedState}
          onSelectState={state => { setSelectedState(state); setAiSummary(undefined); }}
          activeCategory={activeCategory}
        />
        <ResourcePanel
          resources={filteredResources}
          selectedState={selectedState}
          isLoading={isLoading}
          aiSummary={aiSummary}
          onSearch={handleSearch}
          searchQuery={searchQuery}
          onSearchChange={val => { setSearchQuery(val); if (!val) setAiSummary(undefined); }}
        />
      </div>
    </div>
  );
}
