import { CATEGORY_CONFIG } from "@/lib/utils";
import { ResourceCategory } from "@/types";

export const DEFAULT_VIEWPORT = {
  longitude: -95.7,
  latitude: 37.1,
  zoom: 3.8,
};

export function buildMarkerColor(category: string, urgent: boolean): string {
  if (urgent) return "#ef4444";
  const colors: Record<string, string> = {
    shelter:  "#3b82f6",
    food:     "#22c55e",
    legal:    "#a855f7",
    medical:  "#ef4444",
    language: "#f59e0b",
  };
  return colors[category] ?? "#2563eb";
}

/**
 * Builds a two-layer custom marker element:
 *   - Base: category-colored circle (14px regular, 16px selected)
 *   - Badge: 6px red circle at top-right when resource is urgent
 */
export function buildMarkerElement({
  category,
  urgent,
  selected = false,
}: {
  category: ResourceCategory;
  urgent: boolean;
  selected?: boolean;
}): HTMLDivElement {
  const cat = CATEGORY_CONFIG[category];
  const baseSize = selected ? 16 : 14;

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    position: relative;
    width: ${baseSize}px;
    height: ${baseSize}px;
    cursor: pointer;
  `;

  const base = document.createElement("div");
  base.style.cssText = `
    width: ${baseSize}px;
    height: ${baseSize}px;
    border-radius: 50%;
    background: ${cat.color};
    border: 1.5px solid rgba(255,255,255,0.25);
    box-sizing: border-box;
  `;
  wrapper.appendChild(base);

  if (urgent) {
    const badge = document.createElement("div");
    badge.style.cssText = `
      position: absolute;
      top: -3px;
      right: -3px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ef4444;
      box-shadow: 0 0 4px #ef4444;
    `;
    wrapper.appendChild(badge);
  }

  return wrapper;
}
