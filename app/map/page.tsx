"use client";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/ui/Navbar";
import { Sidebar } from "@/components/ui/Sidebar";
import { MapView } from "@/components/map/MapView";
import { ResourcePanel } from "@/components/resources/ResourcePanel";
import { ReportModal } from "@/components/ui/ReportModal";
import { Resource, ResourceCategory } from "@/types";
import { CATEGORY_CONFIG } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function MapPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [filteredResources, setFilteredResources] = useState<Resource[]>([]);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ResourceCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [aiSummary, setAiSummary] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState("EN");

  // Mobile drawer state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  // Report modal
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Prevent body scroll when a drawer is open on mobile
  useEffect(() => {
    const open = mobileSidebarOpen || mobilePanelOpen || reportModalOpen;
    document.body.classList.toggle("drawer-open", open);
    return () => document.body.classList.remove("drawer-open");
  }, [mobileSidebarOpen, mobilePanelOpen, reportModalOpen]);

  // Fetch resources when state/category changes
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

  function handleSelectState(state: string) {
    setSelectedState(state);
    setAiSummary(undefined);
    // On mobile, open the resource panel when a state is selected
    setMobilePanelOpen(true);
  }

  const categoryCounts = Object.fromEntries(
    Object.keys(CATEGORY_CONFIG).map(cat => [cat, resources.filter(r => r.category === cat).length])
  );

  const hasOverlay = mobileSidebarOpen || mobilePanelOpen;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar currentLang={currentLang} onLanguageChange={setCurrentLang} />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay backdrop */}
        {hasOverlay && (
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-30"
            aria-hidden="true"
            onClick={() => { setMobileSidebarOpen(false); setMobilePanelOpen(false); }}
          />
        )}

        {/* Sidebar — desktop: static, mobile: fixed left drawer */}
        <div
          className={cn(
            "fixed md:relative inset-y-0 left-0 z-40 md:z-auto transition-transform duration-200 ease-in-out",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <Sidebar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            categoryCounts={categoryCounts}
            onReportMissing={() => setReportModalOpen(true)}
            onClose={() => setMobileSidebarOpen(false)}
          />
        </div>

        {/* Map — fills remaining space */}
        <MapView
          resources={filteredResources}
          selectedState={selectedState}
          onSelectState={handleSelectState}
          activeCategory={activeCategory}
          onMobileSidebarToggle={() => setMobileSidebarOpen(true)}
          onMobilePanelToggle={() => setMobilePanelOpen(true)}
        />

        {/* Resource panel — desktop: static, mobile: fixed right drawer */}
        <div
          className={cn(
            "fixed md:relative inset-y-0 right-0 z-40 md:z-auto transition-transform duration-200 ease-in-out",
            mobilePanelOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
          )}
        >
          <ResourcePanel
            resources={filteredResources}
            selectedState={selectedState}
            isLoading={isLoading}
            aiSummary={aiSummary}
            onSearch={handleSearch}
            searchQuery={searchQuery}
            onSearchChange={val => { setSearchQuery(val); if (!val) setAiSummary(undefined); }}
            onClose={() => setMobilePanelOpen(false)}
          />
        </div>
      </div>

      {/* Report Missing Resource modal */}
      {reportModalOpen && (
        <ReportModal
          onClose={() => setReportModalOpen(false)}
          selectedState={selectedState}
        />
      )}
    </div>
  );
}
