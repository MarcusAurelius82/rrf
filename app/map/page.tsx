"use client";
import { useState, useEffect, useCallback, useRef } from "react";
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
import { TranslationProvider } from "@/contexts/TranslationContext";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type MapBounds = { north: number; south: number; east: number; west: number };

export default function MapPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [filteredResources, setFilteredResources] = useState<Resource[]>([]);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ResourceCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState("EN");
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [aiSummary, setAiSummary] = useState<string | undefined>();

  // Mobile drawer state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Report modal
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Refs for debounced viewport fetch
  const boundsDebounceRef  = useRef<NodeJS.Timeout>();
  const fetchControllerRef = useRef<AbortController | null>(null);
  const mapBoundsRef       = useRef<MapBounds | null>(null);
  const activeCategoryRef  = useRef(activeCategory);
  activeCategoryRef.current = activeCategory;

  // Resources visible in the current map viewport — drives the list panels.
  // Since the API already filters by bbox, this is mostly a no-op safety check.
  const visibleResources = mapBounds
    ? filteredResources.filter(r =>
        r.lat >= mapBounds.south && r.lat <= mapBounds.north &&
        r.lng >= mapBounds.west  && r.lng <= mapBounds.east
      )
    : filteredResources;

  // Prevent body scroll when a drawer is open on mobile
  useEffect(() => {
    const open = mobileSidebarOpen || reportModalOpen;
    document.body.classList.toggle("drawer-open", open);
    return () => document.body.classList.remove("drawer-open");
  }, [mobileSidebarOpen, reportModalOpen]);

  // ── Viewport fetch ────────────────────────────────────────────────────────
  // Fetches resources for the current bbox + category. Cancels in-flight
  // requests when a new one arrives so stale data never overwrites fresh data.
  function fetchViewport(bounds: MapBounds, category: ResourceCategory | null) {
    fetchControllerRef.current?.abort();
    fetchControllerRef.current = new AbortController();

    setIsLoading(true);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    params.set("min_lat", bounds.south.toFixed(6));
    params.set("max_lat", bounds.north.toFixed(6));
    params.set("min_lng", bounds.west.toFixed(6));
    params.set("max_lng", bounds.east.toFixed(6));

    fetch(`/api/resources?${params}`, { signal: fetchControllerRef.current.signal })
      .then(r => r.json())
      .then(({ data }) => {
        setResources(data || []);
        setFilteredResources(data || []);
        setSearchQuery("");
      })
      .catch(err => { if (err.name !== "AbortError") console.error(err); })
      .finally(() => setIsLoading(false));
  }

  // Bounds change from MapView — debounce 400ms so we don't fire on every
  // pixel of a pan, then fetch full fidelity data for the new viewport.
  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
    mapBoundsRef.current = bounds;
    clearTimeout(boundsDebounceRef.current);
    boundsDebounceRef.current = setTimeout(() => {
      fetchViewport(bounds, activeCategoryRef.current);
    }, 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when category changes, using the last known bounds
  useEffect(() => {
    if (!mapBoundsRef.current) return;
    fetchViewport(mapBoundsRef.current, activeCategory);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  // ── Search ────────────────────────────────────────────────────────────────
  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredResources(resources);
      setAiSummary(undefined);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, category: activeCategory, state: selectedState }),
      });
      const { data } = await res.json();
      setFilteredResources(data?.resources || []);
      setAiSummary(data?.ai_summary || undefined);
    } catch (err) {
      console.error(err);
      setAiSummary(undefined);
    } finally {
      setIsLoading(false);
    }
  }

  // Location search (city/zip) — sort by proximity and fly map there
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
    <TranslationProvider lang={currentLang}>
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
          onBoundsChange={handleBoundsChange}
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
            resources={visibleResources}
            totalCount={filteredResources.length}
            selectedState={selectedState}
            isLoading={isLoading}
            aiSummary={aiSummary}
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
        resources={visibleResources}
        totalCount={filteredResources.length}
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
    </TranslationProvider>
  );
}
