import { Resource } from "@/types";

export const DEFAULT_VIEWPORT = {
  longitude: -95.7,
  latitude: 37.5,
  zoom: 4.2,
};

// Rough outline of continental US landmass (clockwise from Pacific NW).
// Used to filter grid points that fall in ocean / Canada / Mexico.
const US_LAND_POLYGON: [number, number][] = [
  [-124.7, 48.4],  // WA coast
  [-124.5, 47.5],
  [-124.3, 45.8],  // OR coast
  [-124.2, 43.2],
  [-124.0, 41.5],  // N CA coast
  [-122.5, 37.5],  // Bay Area
  [-120.8, 35.2],
  [-118.5, 33.9],  // LA area
  [-117.2, 32.5],  // CA/Mexico border
  [-111.0, 31.4],  // AZ/Mexico
  [-106.6, 31.8],  // NM/Mexico
  [-104.5, 29.7],
  [-102.7, 29.7],
  [-100.0, 28.0],
  [-97.4, 25.8],   // TX southernmost tip
  [-97.1, 26.5],
  [-94.1, 29.0],   // TX/LA Gulf coast
  [-91.0, 29.0],   // LA coast
  [-89.6, 29.5],
  [-88.8, 30.3],
  [-87.0, 30.5],   // FL panhandle west
  [-85.5, 29.6],
  [-84.5, 29.6],
  [-82.0, 28.0],   // FL west coast
  [-81.8, 25.2],   // FL tip
  [-80.6, 24.8],
  [-80.0, 25.5],
  [-80.0, 31.0],   // FL east coast
  [-81.4, 31.0],
  [-80.0, 32.0],
  [-77.9, 34.1],   // NC coast
  [-76.0, 34.8],
  [-75.5, 35.5],
  [-74.9, 38.9],   // NJ/NY coast
  [-73.8, 40.6],
  [-71.9, 41.3],
  [-70.0, 42.0],
  [-69.9, 43.9],   // ME coast
  [-67.1, 44.5],
  [-67.0, 47.5],   // ME north
  // Canadian border east → west
  [-69.3, 47.4],
  [-71.5, 45.1],
  [-73.3, 45.0],   // NY/VT
  [-76.9, 43.9],
  [-79.8, 43.5],   // Lake Ontario/Erie
  [-82.5, 41.7],
  [-84.8, 41.7],
  [-86.5, 41.8],   // Lake Michigan area
  [-87.5, 42.5],
  [-90.4, 46.6],
  [-92.1, 46.8],
  [-95.2, 49.0],   // MN north
  [-97.2, 49.0],
  [-100.0, 49.0],
  [-104.0, 49.0],
  [-109.0, 49.0],
  [-116.0, 49.0],
  [-120.0, 49.0],
  [-124.7, 48.4],  // back to start
];

function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Generate a regular grid of [lng, lat] points covering the continental US.
 * Points outside the rough US landmass polygon are filtered out.
 * At spacing=0.8 produces ~1,800–2,200 points.
 */
export function generateUSGrid(spacing: number): [number, number][] {
  const points: [number, number][] = [];
  for (let lat = 24; lat <= 49; lat += spacing) {
    for (let lng = -125; lng <= -66; lng += spacing) {
      if (pointInPolygon([lng, lat], US_LAND_POLYGON)) {
        points.push([lng, lat]);
      }
    }
  }
  return points;
}

/**
 * For each grid point, count resources within radiusDegrees using fast
 * Euclidean distance (sufficient accuracy at this scale).
 * Returns normalized densities (0–1) and raw counts.
 */
export function calculateGridDensity(
  grid: [number, number][],
  resources: Resource[],
  radiusDegrees: number,
): { densities: number[]; counts: number[] } {
  const r2 = radiusDegrees * radiusDegrees;

  const counts = grid.map(([glng, glat]) => {
    let count = 0;
    for (const res of resources) {
      const dlng = res.lng - glng;
      const dlat = res.lat - glat;
      if (dlng * dlng + dlat * dlat <= r2) count++;
    }
    return count;
  });

  const maxCount = counts.reduce((max, c) => (c > max ? c : max), 1);
  const densities = counts.map(c => c / maxCount);

  return { densities, counts };
}
