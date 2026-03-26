"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Resource, ResourceCategory } from "@/types";
import { CATEGORY_CONFIG } from "@/lib/utils";
import { buildMarkerElement } from "@/lib/mapbox";
import { useTheme } from "@/lib/theme";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const MAP_STYLES: Record<"dark" | "light", string> = {
  dark:  "mapbox://styles/mapbox/dark-v11",
  light: "mapbox://styles/mapbox/light-v11",
};

// US bounding box — ignore clicks outside continental US / territories
const US_BOUNDS: [[number, number], [number, number]] = [
  [-180, 15],
  [-60,  72],
];

/**
 * Per-state "don't render west of this longitude" limit.
 * Prevents 211 API geocoding errors (waterfront addresses snapped into bays/ocean)
 * from placing markers in water. Values chosen to be ~0.1° inside the true coastline.
 */
const COASTAL_WEST_LIMIT: Partial<Record<string, number>> = {
  CA: -122.6,  // Golden Gate ~-122.51; excludes SF Bay overshots + Pacific outliers
  OR: -124.2,
  WA: -124.4,
  NY: -74.3,   // Western edge of NYC outer islands
  FL: -87.6,
  TX: -97.5,   // Corpus Christi coast
  ME: -71.0,
  MA: -71.0,
};

/** Returns true only if coordinates fall within US bounds and are not in coastal water */
function isValidUSCoord(lat: unknown, lng: unknown, state?: string): boolean {
  const la = Number(lat), lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (la < 24 || la > 49 || lo < -125 || lo > -66) return false;
  if (state && COASTAL_WEST_LIMIT[state] !== undefined && lo < COASTAL_WEST_LIMIT[state]!) return false;
  return true;
}

/**
 * Returns a safe [lng, lat] to render a marker at.
 * Falls back to the state centroid when coords are invalid or implausibly
 * far from the state center (geocoding errors placing resources in water/wrong state).
 */
function getSafeResourceCoord(resource: Resource): [number, number] | null {
  // TEST BRANCH: treat resource.lat as lng and resource.lng as lat
  // (diagnosing whether DB columns are stored swapped)
  const lat = resource.lng; // intentionally swapped
  const lng = resource.lat; // intentionally swapped

  // Invalid coords → use centroid, or drop marker if no centroid
  if (!isValidUSCoord(lat, lng, resource.state)) {
    return STATE_CENTROIDS[resource.state] ?? null;
  }

  // No centroid to sanity-check against → trust raw coords
  const centroid = STATE_CENTROIDS[resource.state];
  if (!centroid) return [lng, lat];

  // Coords implausibly far from state centroid → snap to centroid
  const [stateLng, stateLat] = centroid;
  const lngDelta = Math.abs(lng - stateLng);
  const latDelta = Math.abs(lat - stateLat);
  if (lngDelta > 8.5 || latDelta > 6) return centroid;

  return [lng, lat];
}

interface MapViewProps {
  resources: Resource[];
  selectedState: string | null;
  onSelectState: (state: string) => void;
  activeCategory: ResourceCategory | null;
  onMobileSidebarToggle?: () => void;
  onMobilePanelToggle?: () => void;
}

// State centroids for fly-to
const STATE_CENTROIDS: Record<string, [number, number]> = {
  AL:[-86.8,32.8],AK:[-153,64],AZ:[-111.1,34.3],AR:[-92.4,34.9],CA:[-119.7,37.2],
  CO:[-105.5,39.0],CT:[-72.7,41.6],DE:[-75.5,39.0],FL:[-81.5,27.9],GA:[-83.4,32.7],
  HI:[-157.5,20.3],ID:[-114.5,44.3],IL:[-89.2,40.0],IN:[-86.3,40.3],IA:[-93.1,42.0],
  KS:[-98.4,38.5],KY:[-84.3,37.8],LA:[-91.8,31.1],ME:[-69.4,45.2],MD:[-76.6,39.1],
  MA:[-71.5,42.3],MI:[-84.7,44.3],MN:[-94.3,46.4],MS:[-89.7,32.7],MO:[-92.3,38.4],
  MT:[-110.5,47.0],NE:[-99.9,41.5],NV:[-116.4,38.8],NH:[-71.6,43.7],NJ:[-74.4,40.0],
  NM:[-106.1,34.5],NY:[-74.9,43.0],NC:[-79.0,35.5],ND:[-100.5,47.5],OH:[-82.8,40.4],
  OK:[-97.5,35.5],OR:[-120.5,44.0],PA:[-77.2,40.9],RI:[-71.6,41.6],SC:[-80.9,33.8],
  SD:[-100.2,44.4],TN:[-86.7,35.8],TX:[-99.3,31.4],UT:[-111.1,39.3],VT:[-72.7,44.0],
  VA:[-78.5,37.5],WA:[-120.5,47.5],WV:[-80.6,38.6],WI:[-89.8,44.2],WY:[-107.6,43.0],
  DC:[-77.0,38.9],PR:[-66.5,18.2],
};

/** Reverse-geocode a lng/lat to a 2-letter US state code via Mapbox */
async function reverseGeocodeState(lng: number, lat: number): Promise<string | null> {
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
      `?types=region&country=US&access_token=${mapboxgl.accessToken}`;
    const res  = await fetch(url);
    const json = await res.json() as { features?: Array<{ properties?: { short_code?: string } }> };
    const code = json.features?.[0]?.properties?.short_code; // e.g. "US-NY"
    if (code?.startsWith("US-")) return code.slice(3).toUpperCase();
  } catch { /* ignore */ }
  return null;
}

export function MapView({
  resources,
  selectedState,
  onSelectState,
  activeCategory,
  onMobileSidebarToggle,
  onMobilePanelToggle,
}: MapViewProps) {
  const { theme } = useTheme();
  const mapContainer      = useRef<HTMLDivElement>(null);
  const map               = useRef<mapboxgl.Map | null>(null);
  const markersRef        = useRef<mapboxgl.Marker[]>([]);
  const stateMarkersRef   = useRef<mapboxgl.Marker[]>([]);
  const geocodingRef      = useRef(false); // debounce reverse-geocode requests
  const [mapLoaded, setMapLoaded]   = useState(false);
  const [clicking, setClicking]     = useState(false);
  const [mapZoom, setMapZoom]       = useState(3.8);
  const [mapCenter, setMapCenter]   = useState<{ lat: number; lng: number }>({ lat: 37.09, lng: -95.71 });

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style:     MAP_STYLES[theme],
      center:    [-95.7, 37.1],
      zoom:      3.8,
      minZoom:   2,
      maxZoom:   14,
    });

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.current.on("load", () => {
      setMapLoaded(true);

      // Show pointer cursor over the map to hint it's clickable
      map.current!.getCanvas().style.cursor = "pointer";
    });

    map.current.on("moveend", () => {
      if (!map.current) return;
      const c = map.current.getCenter();
      setMapCenter({ lat: c.lat, lng: c.lng });
    });

    map.current.on("zoom", () => {
      if (!map.current) return;
      setMapZoom(map.current.getZoom());
    });

    // ── Click anywhere on map → reverse-geocode → select state ──────────────
    map.current.on("click", async (e) => {
      if (geocodingRef.current) return; // already processing a click
      const { lng, lat } = e.lngLat;

      // Rough US bounding box check before hitting the API
      if (
        lng < US_BOUNDS[0][0] || lng > US_BOUNDS[1][0] ||
        lat < US_BOUNDS[0][1] || lat > US_BOUNDS[1][1]
      ) return;

      geocodingRef.current = true;
      setClicking(true);
      try {
        const stateCode = await reverseGeocodeState(lng, lat);
        if (stateCode) onSelectState(stateCode);
      } finally {
        geocodingRef.current = false;
        setClicking(false);
      }
    });

    return () => { map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Popup HTML (CSS variables auto-adapt to theme) ────────────────────────
  function buildPopupHTML(resource: Resource, catColor: string, catLabel: string): string {
    return `<div style="background:var(--popup-bg);border:1px solid var(--popup-border);border-radius:8px;padding:10px;font-family:'IBM Plex Mono',monospace;min-width:200px;">
      <div style="font-size:8px;color:${catColor};letter-spacing:0.1em;margin-bottom:4px;text-transform:uppercase">${catLabel}</div>
      <div style="font-size:12px;font-weight:700;color:var(--popup-text);margin-bottom:6px;line-height:1.3">${resource.name}</div>
      <div style="font-size:10px;color:var(--popup-sub)">${resource.address}</div>
      ${resource.phone ? `<div style="font-size:10px;color:var(--popup-sub);margin-top:3px">${resource.phone}</div>` : ""}
      ${resource.urgent ? `<div style="font-size:8px;color:#ef4444;margin-top:5px;letter-spacing:0.1em;font-weight:700">⚠ URGENT</div>` : ""}
    </div>`;
  }

  // ── Render individual resource pins (zoom ≥ 6) ───────────────────────────
  const renderMarkers = useCallback(() => {
    if (!map.current || !mapLoaded) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const filtered = activeCategory
      ? resources.filter(r => r.category === activeCategory)
      : resources;

    filtered.forEach(resource => {
      const safeCoord = getSafeResourceCoord(resource);
      if (!safeCoord) return;
      const cat = CATEGORY_CONFIG[resource.category];

      const el = buildMarkerElement({ category: resource.category, urgent: resource.urgent });
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `${resource.name} — ${cat.label}`);
      el.setAttribute("tabindex", "0");
      const pinInner = el.firstElementChild as HTMLElement;
      el.onmouseenter = () => { pinInner.style.transform = "scale(1.4)"; };
      el.onmouseleave = () => { pinInner.style.transform = "scale(1)"; };
      el.onclick = (e) => { e.stopPropagation(); onSelectState(resource.state); };
      el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") onSelectState(resource.state); };

      const popup = new mapboxgl.Popup({ offset: 12, closeButton: false, maxWidth: "240px" })
        .setHTML(buildPopupHTML(resource, cat.color, cat.label));

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(safeCoord)
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources, activeCategory, mapLoaded, onSelectState]);

  // ── Render per-state cluster pins (zoom < 6) ──────────────────────────────
  const renderStateMarkers = useCallback(() => {
    if (!map.current || !mapLoaded) return;

    stateMarkersRef.current.forEach(m => m.remove());
    stateMarkersRef.current = [];

    const filtered = activeCategory
      ? resources.filter(r => r.category === activeCategory)
      : resources;

    // Aggregate per state
    const stateInfo: Record<string, { count: number; hasUrgent: boolean }> = {};
    for (const r of filtered) {
      if (!stateInfo[r.state]) stateInfo[r.state] = { count: 0, hasUrgent: false };
      stateInfo[r.state].count++;
      if (r.urgent) stateInfo[r.state].hasUrgent = true;
    }

    for (const [stateCode, info] of Object.entries(stateInfo)) {
      const coords = STATE_CENTROIDS[stateCode];
      if (!coords) continue;

      // Diameter: 18px min, 36px max, scales with count
      const size = Math.min(36, Math.max(18, 18 + Math.floor(Math.log2(info.count + 1) * 5)));
      const fontSize = size <= 22 ? 8 : size <= 28 ? 10 : 11;

      const el = document.createElement("div");
      el.style.cssText = `position:relative;width:${size}px;height:${size}px;cursor:pointer;`;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `${stateCode}: ${info.count} resources`);
      el.setAttribute("tabindex", "0");
      // Inner element receives hover transforms — el is never transformed
      const clusterInner = document.createElement("div");
      clusterInner.style.cssText = `position:relative;width:${size}px;height:${size}px;transition:transform 0.15s;`;
      el.onmouseenter = () => { clusterInner.style.transform = "scale(1.2)"; };
      el.onmouseleave = () => { clusterInner.style.transform = "scale(1)"; };

      const circle = document.createElement("div");
      circle.style.cssText = `
        width:${size}px;height:${size}px;border-radius:50%;
        background:#2563eb;
        box-shadow:0 0 8px #2563eb,0 0 16px rgba(37,99,235,0.4);
        display:flex;align-items:center;justify-content:center;
        border:1.5px solid rgba(255,255,255,0.25);box-sizing:border-box;
      `;

      const label = document.createElement("span");
      label.style.cssText = `
        font-family:'IBM Plex Mono',monospace;
        font-size:${fontSize}px;font-weight:700;color:#ffffff;
        line-height:1;pointer-events:none;
      `;
      label.textContent = String(info.count);
      circle.appendChild(label);
      clusterInner.appendChild(circle);

      if (info.hasUrgent) {
        const badge = document.createElement("div");
        badge.style.cssText = `
          position:absolute;top:-3px;right:-3px;
          width:8px;height:8px;border-radius:50%;
          background:#ef4444;box-shadow:0 0 4px #ef4444;
        `;
        clusterInner.appendChild(badge);
      }

      el.appendChild(clusterInner);

      el.onclick = (e) => {
        e.stopPropagation();
        onSelectState(stateCode);
        map.current?.flyTo({ center: coords, zoom: 7, duration: 1200, essential: true });
      };
      el.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          onSelectState(stateCode);
          map.current?.flyTo({ center: coords, zoom: 7, duration: 1200, essential: true });
        }
      };

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(map.current!);

      stateMarkersRef.current.push(marker);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources, activeCategory, mapLoaded, onSelectState]);

  // ── Switch map style when theme changes ───────────────────────────────────
  const themeRef = useRef(theme);
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (themeRef.current === theme) return;
    themeRef.current = theme;
    map.current.once("idle", () => {
      if (!map.current) return;
      if (map.current.getZoom() < 6) renderStateMarkers();
      else renderMarkers();
    });
    map.current.setStyle(MAP_STYLES[theme]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, mapLoaded, renderMarkers, renderStateMarkers]);

  // ── Zoom-aware render: state clusters below zoom 6, individual pins above ──
  useEffect(() => {
    if (!mapLoaded) return;
    if (mapZoom < 6) {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      renderStateMarkers();
    } else {
      stateMarkersRef.current.forEach(m => m.remove());
      stateMarkersRef.current = [];
      renderMarkers();
    }
  }, [mapZoom, mapLoaded, renderMarkers, renderStateMarkers]);

  // ── Fly to selected state ─────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapLoaded || !selectedState) return;
    const coords = STATE_CENTROIDS[selectedState];
    if (!coords) return;
    map.current.flyTo({ center: coords, zoom: 6.5, duration: 1200, essential: true });
  }, [selectedState, mapLoaded]);

  const latStr = `${Math.abs(mapCenter.lat).toFixed(2)}°${mapCenter.lat >= 0 ? "N" : "S"}`;
  const lngStr = `${Math.abs(mapCenter.lng).toFixed(2)}°${mapCenter.lng >= 0 ? "E" : "W"}`;

  return (
    <div className="relative flex-1 overflow-hidden" role="region" aria-label="Interactive resource map">
      {/* Map header overlay */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="font-mono text-[9px] text-content-muted tracking-[0.12em] mb-1" aria-hidden="true">
          ACTIVE SECTOR
        </div>
        <div
          className="font-mono text-[20px] font-bold tracking-[0.04em] text-content-primary border border-border-active px-3.5 py-2 rounded-md bg-surface-0/80 backdrop-blur-sm"
          aria-live="polite"
          aria-label={`Viewing: ${selectedState ? `State ${selectedState}` : "National overview"}`}
        >
          {selectedState ? `STATE — ${selectedState}` : "USA_NATIONAL"}
        </div>
        <div
          className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-content-primary mt-2 px-2.5 py-1.5 rounded-full bg-accent-dim border border-accent-border w-fit"
          aria-live="polite"
          aria-label={`${resources.length} active resource centers`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_#2563eb] animate-pulse" aria-hidden="true" />
          {resources.length} ACTIVE CENTERS
        </div>
      </div>

      {/* Click-to-select hint — only shown before first state selection */}
      {!selectedState && mapLoaded && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="font-mono text-[10px] text-content-secondary bg-surface-0/80 border border-border px-3 py-1.5 rounded-full backdrop-blur-sm tracking-[0.08em] whitespace-nowrap">
            {clicking ? "LOCATING…" : "CLICK ANY STATE TO LOAD RESOURCES"}
          </div>
        </div>
      )}

      {/* Loading indicator during reverse geocode */}
      {clicking && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="font-mono text-[11px] text-content-primary bg-surface-0/90 border border-border px-4 py-2 rounded-lg backdrop-blur-sm tracking-[0.1em] animate-pulse">
            LOCATING STATE…
          </div>
        </div>
      )}

      {/* Mobile toggle buttons */}
      <div className="md:hidden absolute top-4 right-4 z-10 flex flex-col gap-2">
        {onMobileSidebarToggle && (
          <button
            onClick={onMobileSidebarToggle}
            aria-label="Open filters"
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-0/80 border border-border-active backdrop-blur-sm text-content-primary text-[13px] hover:bg-surface-2 transition-all"
          >
            ☰
          </button>
        )}
        {onMobilePanelToggle && (
          <button
            onClick={onMobilePanelToggle}
            aria-label="Open resource list"
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-0/80 border border-border-active backdrop-blur-sm font-mono text-[9px] font-bold text-content-primary hover:bg-surface-2 transition-all leading-none"
          >
            LIST
          </button>
        )}
      </div>

      {/* Map container */}
      <div ref={mapContainer} className="w-full h-full" aria-hidden="true" />

      {/* Status bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-9 flex items-center gap-4 md:gap-6 px-3 md:px-4 border-t border-border bg-surface-0/90 backdrop-blur-sm font-mono text-[10px] text-content-muted tracking-[0.08em]"
        aria-hidden="true"
      >
        <span>LAT <span className="text-content-secondary">{latStr}</span></span>
        <span>LON <span className="text-content-secondary">{lngStr}</span></span>
        {selectedState && <span className="hidden sm:inline">SELECTED <span className="text-content-secondary">{selectedState}</span></span>}
        <span className="ml-auto">STATUS <span className="text-accent">LIVE</span></span>
      </div>
    </div>
  );
}
