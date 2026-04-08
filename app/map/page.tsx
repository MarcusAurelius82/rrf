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

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MapPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [filteredResources, setFilteredResources] = useState<Resource[]>([]);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ResourceCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState("EN");
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);

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

  // Location search (city/zip) — sort resources by proximity, fly map there
  function handleLocationSearch(coords: [number, number], label: string) {
    const [lng, lat] = coords;
    setFlyToCoords(coords);
    setSearchQuery(label);
    const sorted = [...resources].sort((a, b) =>
      haversineKm(lat, lng, a.lat, a.lng) - haversineKm(lat, lng, b.lat, b.lng)
    );
    setFilteredResources(sorted);
  }

  const handleSelectState = useCallback((state: string) => {
    setSelectedState(state);
  }, []);

  const handleSelectResource = useCallback((id: string | null) => {
    setSelectedResourceId(id);
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
            className="md:hidden fixed top-[52px] inset-x-0 bottom-0 bg-black/60 z-30"
            aria-hidden="true"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar — desktop: static, mobile: fixed left drawer below navbar */}
        <div
          className={cn(
            "fixed top-[52px] bottom-0 md:relative md:top-auto md:bottom-auto md:inset-y-0 left-0 z-40 md:z-auto transition-transform duration-200 ease-in-out w-full md:w-auto",
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
          flyToCoords={flyToCoords}
        />

        {/* Mobile search bar — floats over map, leaves room for hamburger button */}
        <div className="md:hidden absolute top-3 left-3 right-14 z-20">
          <MapSearchInput
            resources={resources}
            value={searchQuery}
            onSearch={handleSearch}
            onLocationSearch={handleLocationSearch}
            placeholder="Search shelter, food, legal aid…"
          />
        </div>

        {/* Resource panel — large screens only (1024px+) */}
        <div className="hidden lg:block relative">
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
        onCategoryChange={setActiveCategory}
        isLoading={isLoading}
        selectedResourceId={selectedResourceId}
        onSelectResource={handleSelectResource}
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
