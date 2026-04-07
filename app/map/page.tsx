"use client";
import { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/ui/Navbar";
import { Sidebar } from "@/components/ui/Sidebar";
import { MapView } from "@/components/map/MapView";
import { ResourcePanel } from "@/components/resources/ResourcePanel";
import { MobileBottomSheet } from "@/components/ui/MobileBottomSheet";
import { MapSearchInput } from "@/components/ui/MapSearchInput";
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
  const [isLoading, setIsLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState("EN");
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [bottomSheetCollapsed, setBottomSheetCollapsed] = useState(false);

  // Mobile drawer state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Report modal
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Prevent body scroll when a drawer is open on mobile
  useEffect(() => {
    const open = mobileSidebarOpen || reportModalOpen;
    document.body.classList.toggle("drawer-open", open);
    return () => document.body.classList.remove("drawer-open");
  }, [mobileSidebarOpen, reportModalOpen]);

  // Fetch resources nationwide — state selection only flies the map
  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (activeCategory) params.set("category", activeCategory);

    fetch(`/api/resources?${params}`)
      .then(r => r.json())
      .then(({ data }) => {
        setResources(data || []);
        setFilteredResources(data || []);
        setSearchQuery(""); // clear search when base data changes
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [activeCategory]);

  // Full-text search via Postgres
  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredResources(resources);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, category: activeCategory }),
      });
      const { data } = await res.json();
      setFilteredResources(data?.resources || []);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  }

  const handleSelectState = useCallback((state: string) => {
    setSelectedState(state);
  }, []);

  // Selecting a resource (pin tap) expands the bottom sheet
  const handleSelectResource = useCallback((id: string | null) => {
    setSelectedResourceId(id);
    if (id) setBottomSheetCollapsed(false);
  }, []);

  const categoryCounts = Object.fromEntries(
    Object.keys(CATEGORY_CONFIG).map(cat => [cat, resources.filter(r => r.category === cat).length])
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar currentLang={currentLang} onLanguageChange={setCurrentLang} />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay backdrop — sidebar only */}
        {mobileSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-30"
            aria-hidden="true"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar — desktop: static, mobile: fixed left drawer */}
        <div
          className={cn(
            "fixed md:relative inset-y-0 left-0 z-40 md:z-auto transition-transform duration-200 ease-in-out w-full md:w-auto",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <Sidebar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            categoryCounts={categoryCounts}
            onReportMissing={() => setReportModalOpen(true)}
            onClose={() => setMobileSidebarOpen(false)}
            searchQuery={searchQuery}
            onSearch={handleSearch}
          />
        </div>

        {/* Map — fills remaining space */}
        <MapView
          resources={filteredResources}
          selectedState={selectedState}
          onSelectState={handleSelectState}
          activeCategory={activeCategory}
          onMobileSidebarToggle={() => setMobileSidebarOpen(o => !o)}
          selectedResourceId={selectedResourceId}
          onSelectResource={handleSelectResource}
          onMapTap={() => setBottomSheetCollapsed(true)}
        />

        {/* Mobile search bar — floats over map, leaves room for hamburger button */}
        <div className="md:hidden absolute top-3 left-3 right-14 z-20">
          <MapSearchInput
            resources={resources}
            value={searchQuery}
            onSearch={handleSearch}
            placeholder="Search shelter, food, legal aid…"
          />
        </div>

        {/* Resource panel — desktop only */}
        <div className="hidden md:block relative">
          <ResourcePanel
            resources={filteredResources}
            selectedState={selectedState}
            isLoading={isLoading}
            onSearch={handleSearch}
            searchQuery={searchQuery}
            onSearchChange={handleSearch}
            selectedResourceId={selectedResourceId}
            onSelectResource={handleSelectResource}
          />
        </div>
      </div>

      {/* Mobile bottom sheet — category pills + horizontal card scroll */}
      <MobileBottomSheet
        resources={filteredResources}
        activeCategory={activeCategory}
        onCategoryChange={cat => { setActiveCategory(cat); setBottomSheetCollapsed(false); }}
        isLoading={isLoading}
        selectedResourceId={selectedResourceId}
        onSelectResource={handleSelectResource}
        collapsed={bottomSheetCollapsed}
        onCollapse={() => setBottomSheetCollapsed(true)}
      />

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
