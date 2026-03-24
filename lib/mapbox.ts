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
