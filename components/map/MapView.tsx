"use client";
import { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Resource, ResourceCategory } from "@/types";
import { CATEGORY_CONFIG } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const MAP_STYLES: Record<"dark" | "light", string> = {
  dark:  "mapbox://styles/mapbox/dark-v11",
  light: "mapbox://styles/mapbox/light-v11",
};

const US_BOUNDS: [[number, number], [number, number]] = [
  [-180, 15],
  [-60,  72],
];

const COASTAL_WEST_LIMIT: Partial<Record<string, number>> = {
  CA: -122.6,
  OR: -124.2,
  WA: -124.4,
  NY: -74.3,
  FL: -87.6,
  TX: -97.5,
  ME: -71.0,
  MA: -71.0,
};

function isValidUSCoord(lat: unknown, lng: unknown, state?: string): boolean {
  const la = Number(lat), lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (la < 24 || la > 49 || lo < -125 || lo > -66) return false;
  if (state && COASTAL_WEST_LIMIT[state] !== undefined && lo < COASTAL_WEST_LIMIT[state]!) return false;
  return true;
}

function getSafeResourceCoord(resource: Resource): [number, number] | null {
  if (!isValidUSCoord(resource.lat, resource.lng, resource.state)) {
    return STATE_CENTROIDS[resource.state] ?? null;
  }
  const centroid = STATE_CENTROIDS[resource.state];
  if (!centroid) return [resource.lng, resource.lat];
  const [stateLng, stateLat] = centroid;
  if (Math.abs(resource.lng - stateLng) > 8.5 || Math.abs(resource.lat - stateLat) > 6) return centroid;
  return [resource.lng, resource.lat];
}

interface MapViewProps {
  resources: Resource[];
  selectedState: string | null;
  onSelectState: (state: string) => void;
  activeCategory: ResourceCategory | null;
  onMobileSidebarToggle?: () => void;
  onMobilePanelToggle?: () => void;
}

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

async function reverseGeocodeState(lng: number, lat: number): Promise<string | null> {
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
      `?types=region&country=US&access_token=${mapboxgl.accessToken}`;
    const res  = await fetch(url);
    const json = await res.json() as { features?: Array<{ properties?: { short_code?: string } }> };
    const code = json.features?.[0]?.properties?.short_code;
    if (code?.startsWith("US-")) return code.slice(3).toUpperCase();
  } catch { /* ignore */ }
  return null;
}

function buildGroupPopupHTML(group: Resource[]): string {
  const primary = group[0];
  const multi = group.length > 1;
  const hasUrgent = group.some(r => r.urgent);

  const serviceRows = group.map(r => {
    const cat = CATEGORY_CONFIG[r.category];
    return `<div style="display:flex;align-items:baseline;gap:6px;padding:4px 0;border-bottom:1px solid var(--popup-border);">
      <span style="font-size:7px;color:${cat.color};letter-spacing:0.1em;text-transform:uppercase;white-space:nowrap">${cat.label}</span>
      <span style="font-size:11px;font-weight:600;color:var(--popup-text);line-height:1.3">${r.name}</span>
      ${r.urgent ? `<span style="font-size:7px;color:#ef4444;font-weight:700;white-space:nowrap">⚠ URGENT</span>` : ""}
    </div>`;
  }).join("");

  return `<div style="background:var(--popup-bg);border:1px solid var(--popup-border);border-radius:8px;padding:10px;font-family:'IBM Plex Mono',monospace;min-width:220px;max-width:280px;">
    ${multi ? `<div style="font-size:8px;color:#2563eb;letter-spacing:0.1em;margin-bottom:6px;text-transform:uppercase">${group.length} SERVICES AT THIS LOCATION</div>` : ""}
    <div style="margin-bottom:6px">${serviceRows}</div>
    <div style="font-size:10px;color:var(--popup-sub);margin-top:6px">${primary.address}, ${primary.city}</div>
    ${primary.phone ? `<div style="font-size:10px;color:var(--popup-sub);margin-top:2px">${primary.phone}</div>` : ""}
    ${hasUrgent && !multi ? "" : ""}
  </div>`;
}

/** Deduplicate resources by address, build a GeoJSON FeatureCollection */
function buildResourceGeoJSON(resources: Resource[], activeCategory: ResourceCategory | null) {
  const filtered = activeCategory
    ? resources.filter(r => r.category === activeCategory)
    : resources;

  const groups = new Map<string, Resource[]>();
  for (const r of filtered) {
    const key = `${r.address.toLowerCase().trim()}|${r.zip.trim()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: { ids: string; category: string; urgent: boolean };
  }> = [];

  for (const group of groups.values()) {
    const primary = group[0];
    const coord = getSafeResourceCoord(primary);
    if (!coord) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: coord },
      properties: {
        ids: JSON.stringify(group.map(r => r.id)),
        category: primary.category,
        urgent: group.some(r => r.urgent),
      },
    });
  }

  return { type: "FeatureCollection" as const, features };
}

/** Add the resource source and all rendering layers to a map instance */
function setupMapLayers(m: mapboxgl.Map) {
  if (m.getSource("resources")) return; // already set up (e.g. after theme switch)

  m.addSource("resources", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    cluster: true,
    clusterMaxZoom: 11,
    clusterRadius: 40,
  });

  // Cluster bubble
  m.addLayer({
    id: "clusters",
    type: "circle",
    source: "resources",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#2563eb",
      "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 100, 22],
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "rgba(255,255,255,0.25)",
    },
  });

  // Cluster count label
  m.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: "resources",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-size": 11,
      "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
    },
    paint: { "text-color": "#ffffff" },
  });

  // Individual pins — color by category
  m.addLayer({
    id: "resource-pins",
    type: "circle",
    source: "resources",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": [
        "match", ["get", "category"],
        "shelter",  "#3b82f6",
        "food",     "#22c55e",
        "legal",    "#a855f7",
        "medical",  "#ef4444",
        "language", "#f59e0b",
        "#2563eb",
      ],
      "circle-radius": 7,
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "rgba(255,255,255,0.25)",
    },
  });

  // Urgent ring — red outline on urgent pins
  m.addLayer({
    id: "resource-pins-urgent",
    type: "circle",
    source: "resources",
    filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "urgent"], true]],
    paint: {
      "circle-color": "transparent",
      "circle-radius": 10,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ef4444",
    },
  });

  // Pointer cursor
  const setCursor = (cur: string) => () => { m.getCanvas().style.cursor = cur; };
  m.on("mouseenter", "clusters",      setCursor("pointer"));
  m.on("mouseleave", "clusters",      setCursor("pointer"));
  m.on("mouseenter", "resource-pins", setCursor("pointer"));
  m.on("mouseleave", "resource-pins", setCursor("pointer"));

  // Click cluster → zoom to expand
  m.on("click", "clusters", (e) => {
    const feature = e.features?.[0];
    if (!feature) return;
    const clusterId = feature.properties?.cluster_id;
    (m.getSource("resources") as mapboxgl.GeoJSONSource)
      .getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom == null) return;
        m.flyTo({
          center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
          zoom,
          duration: 800,
        });
      });
  });
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
  const mapContainer   = useRef<HTMLDivElement>(null);
  const map            = useRef<mapboxgl.Map | null>(null);
  const popupRef       = useRef<mapboxgl.Popup | null>(null);
  const geocodingRef   = useRef(false);
  const onSelectRef    = useRef(onSelectState);
  onSelectRef.current  = onSelectState; // always latest without re-init

  const [mapLoaded, setMapLoaded] = useState(false);
  const [clicking, setClicking]   = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 37.09, lng: -95.71 });

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
      setupMapLayers(map.current!);
      setMapLoaded(true);
      map.current!.getCanvas().style.cursor = "pointer";
    });

    map.current.on("moveend", () => {
      if (!map.current) return;
      const c = map.current.getCenter();
      setMapCenter({ lat: c.lat, lng: c.lng });
    });

    // Click map → reverse-geocode → select state
    map.current.on("click", async (e) => {
      if (geocodingRef.current) return;
      const { lng, lat } = e.lngLat;
      if (
        lng < US_BOUNDS[0][0] || lng > US_BOUNDS[1][0] ||
        lat < US_BOUNDS[0][1] || lat > US_BOUNDS[1][1]
      ) return;
      geocodingRef.current = true;
      setClicking(true);
      try {
        const stateCode = await reverseGeocodeState(lng, lat);
        if (stateCode) onSelectRef.current(stateCode);
      } finally {
        geocodingRef.current = false;
        setClicking(false);
      }
    });

    return () => { map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update GeoJSON data when resources / category change ─────────────────
  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    const source = map.current.getSource("resources") as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(buildResourceGeoJSON(resources, activeCategory));
  }, [resources, activeCategory, mapLoaded]);

  // ── Pin click handler — needs fresh `resources` for popup content ─────────
  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    const m = map.current;

    const handlePinClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;

      let ids: string[] = [];
      try { ids = JSON.parse(feature.properties?.ids || "[]"); } catch { return; }

      const group = ids
        .map(id => resources.find(r => r.id === id))
        .filter((r): r is Resource => Boolean(r));
      if (!group.length) return;

      const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      popupRef.current?.remove();
      popupRef.current = new mapboxgl.Popup({ offset: 12, maxWidth: "300px", closeButton: true })
        .setLngLat(coords)
        .setHTML(buildGroupPopupHTML(group))
        .addTo(m);
    };

    m.on("click", "resource-pins", handlePinClick);
    return () => { m.off("click", "resource-pins", handlePinClick); };
  }, [resources, mapLoaded]);

  // ── Theme switch — re-add layers after new style loads ───────────────────
  const themeRef = useRef(theme);
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (themeRef.current === theme) return;
    themeRef.current = theme;
    map.current.once("idle", () => {
      if (!map.current) return;
      setupMapLayers(map.current);
      const source = map.current.getSource("resources") as mapboxgl.GeoJSONSource | undefined;
      source?.setData(buildResourceGeoJSON(resources, activeCategory));
    });
    map.current.setStyle(MAP_STYLES[theme]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, mapLoaded]);

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

      {/* Click-to-select hint */}
      {!selectedState && mapLoaded && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="font-mono text-[10px] text-content-secondary bg-surface-0/80 border border-border px-3 py-1.5 rounded-full backdrop-blur-sm tracking-[0.08em] whitespace-nowrap">
            {clicking ? "LOCATING…" : "CLICK ANY STATE TO LOAD RESOURCES"}
          </div>
        </div>
      )}

      {/* Loading indicator */}
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
