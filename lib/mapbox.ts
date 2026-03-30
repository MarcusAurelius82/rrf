import { Resource, ResourceCategory } from "@/types";
import { CATEGORY_CONFIG } from "@/lib/utils";

export const DEFAULT_VIEWPORT = {
  longitude: -95.7,
  latitude: 37.1,
  zoom: 3.8,
};

/** Continental US grid points at 0.8-degree spacing */
export function generateUSGrid(): [number, number][] {
  const points: [number, number][] = [];
  for (let lng = -125; lng <= -66; lng += 0.8) {
    for (let lat = 24; lat <= 49; lat += 0.8) {
      points.push([lng, lat]);
    }
  }
  return points;
}

export interface ColumnDatum {
  position: [number, number];
  elevation: number;
  color: [number, number, number, number];
  count: number;
  categories: string[];
  categoryCounts: Record<string, number>;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function blendColors(categoryCounts: Record<string, number>): [number, number, number, number] {
  const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  if (total === 0) return [30, 30, 30, 0];
  let r = 0, g = 0, b = 0;
  for (const [cat, count] of Object.entries(categoryCounts)) {
    const weight = count / total;
    const config = CATEGORY_CONFIG[cat as ResourceCategory];
    if (!config) continue;
    const [cr, cg, cb] = hexToRgb(config.color);
    r += cr * weight;
    g += cg * weight;
    b += cb * weight;
  }
  return [Math.round(r), Math.round(g), Math.round(b), 220];
}

export function calculateColumnData(
  grid: [number, number][],
  resources: Resource[],
  radiusDegrees: number
): ColumnDatum[] {
  const t0 = performance.now();
  const result: ColumnDatum[] = [];

  for (const [lng, lat] of grid) {
    const categoryCounts: Record<string, number> = {};
    let count = 0;

    for (const r of resources) {
      const dlng = r.lng - lng;
      const dlat = r.lat - lat;
      // Simple bounding box pre-check for performance
      if (Math.abs(dlng) > radiusDegrees || Math.abs(dlat) > radiusDegrees) continue;
      const dist = Math.sqrt(dlng * dlng + dlat * dlat);
      if (dist <= radiusDegrees) {
        count++;
        categoryCounts[r.category] = (categoryCounts[r.category] ?? 0) + 1;
      }
    }

    if (count === 0) continue; // Skip zero-resource columns entirely

    const elevation = Math.max(8000, Math.sqrt(count) * 25000);
    const color = blendColors(categoryCounts);
    const categories = Object.keys(categoryCounts);

    result.push({ position: [lng, lat], elevation, color, count, categories, categoryCounts });
  }

  const elapsed = performance.now() - t0;
  console.log(
    `[ColumnLayer] grid=${grid.length}, non-zero=${result.length}, ` +
    `resources=${resources.length}, time=${elapsed.toFixed(1)}ms`
  );

  return result;
}
