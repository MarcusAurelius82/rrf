"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Resource, ResourceCategory } from "@/types";
import { CATEGORY_CONFIG } from "@/lib/utils";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface MapViewProps {
  resources: Resource[];
  selectedState: string | null;
  onSelectState: (state: string) => void;
  activeCategory: ResourceCategory | null;
}

// State centroids for label markers
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
};

export function MapView({ resources, selectedState, onSelectState, activeCategory }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-95.7, 37.1],
      zoom: 3.8,
      minZoom: 2,
      maxZoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.current.on("load", () => setMapLoaded(true));

    return () => { map.current?.remove(); map.current = null; };
  }, []);

  // Add resource markers
  const renderMarkers = useCallback(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const filtered = activeCategory ? resources.filter(r => r.category === activeCategory) : resources;

    filtered.forEach(resource => {
      const cat = CATEGORY_CONFIG[resource.category];

      const el = document.createElement("div");
      el.style.cssText = `
        width: ${resource.urgent ? 18 : 14}px;
        height: ${resource.urgent ? 18 : 14}px;
        border-radius: 50%;
        background: ${resource.urgent ? "#ef4444" : cat.color};
        border: 2px solid ${resource.urgent ? "#fca5a5" : "rgba(255,255,255,0.3)"};
        box-shadow: 0 0 ${resource.urgent ? 16 : 10}px ${resource.urgent ? "#ef444466" : cat.color + "66"};
        cursor: pointer;
        transition: transform 0.15s;
      `;
      el.onmouseenter = () => el.style.transform = "scale(1.4)";
      el.onmouseleave = () => el.style.transform = "scale(1)";
      el.onclick = () => onSelectState(resource.state);

      const popup = new mapboxgl.Popup({ offset: 12, closeButton: false, maxWidth: "220px" })
        .setHTML(`
          <div style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;font-family:'IBM Plex Mono',monospace;">
            <div style="font-size:8px;color:${cat.color};letter-spacing:0.1em;margin-bottom:4px">${cat.label}</div>
            <div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:6px">${resource.name}</div>
            <div style="font-size:10px;color:#888">${resource.address}</div>
            ${resource.phone ? `<div style="font-size:10px;color:#888;margin-top:3px">${resource.phone}</div>` : ""}
          </div>
        `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([resource.lng, resource.lat])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [resources, activeCategory, mapLoaded, onSelectState]);

  useEffect(() => { renderMarkers(); }, [renderMarkers]);

  // Fly to selected state
  useEffect(() => {
    if (!map.current || !mapLoaded || !selectedState) return;
    const coords = STATE_CENTROIDS[selectedState];
    if (!coords) return;
    map.current.flyTo({ center: coords, zoom: 6.5, duration: 1200, essential: true });
  }, [selectedState, mapLoaded]);

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Map header overlay */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="font-mono text-[9px] text-[#444] tracking-[0.12em] mb-1">ACTIVE SECTOR</div>
        <div className="font-mono text-[20px] font-bold tracking-[0.04em] text-white border border-white/15 px-3.5 py-2 rounded-md bg-black/80 backdrop-blur-sm">
          {selectedState ? `STATE — ${selectedState}` : "USA_NATIONAL"}
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-white mt-2 px-2.5 py-1.5 rounded-full bg-[#2563eb]/15 border border-[#2563eb]/30 w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] shadow-[0_0_6px_#2563eb] animate-pulse" />
          {resources.length} ACTIVE CENTERS
        </div>
      </div>

      {/* Map container */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Status bar */}
      <div className="absolute bottom-0 left-0 right-0 h-9 flex items-center gap-6 px-4 border-t border-white/[0.08] bg-black/90 backdrop-blur-sm font-mono text-[10px] text-[#444] tracking-[0.08em]">
        <span>LAT <span className="text-[#888]">37.09°N</span></span>
        <span>LON <span className="text-[#888]">95.71°W</span></span>
        {selectedState && <span>SELECTED <span className="text-[#888]">{selectedState}</span></span>}
        <span>STATUS <span className="text-[#2563eb]">OPTIMIZED</span></span>
      </div>
    </div>
  );
}
