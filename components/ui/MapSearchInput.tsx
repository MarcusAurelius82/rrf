"use client";
import { useState, useRef, useEffect } from "react";
import { Resource, ResourceCategory } from "@/types";
import { CATEGORY_CONFIG, cn } from "@/lib/utils";
import { useT, type UIKey } from "@/contexts/TranslationContext";

interface Suggestion {
  label: string;
  sub?: string;
  value: string;
  icon?: string;
  type: "zip" | "city" | "category" | "resource";
}

function getSuggestions(query: string, resources: Resource[]): Suggestion[] {
  const q = query.toLowerCase().trim();
  if (!q || q.length < 2) return [];

  const suggestions: Suggestion[] = [];
  const seen = new Set<string>();

  // Zip code — detect numeric input
  if (/^\d+$/.test(q)) {
    const zipMatches = new Map<string, Resource>();
    resources.filter(r => r.zip?.startsWith(q)).forEach(r => {
      if (!zipMatches.has(r.zip)) zipMatches.set(r.zip, r);
    });
    zipMatches.forEach((r, zip) => {
      suggestions.push({ label: zip, sub: `${r.city}, ${r.state}`, value: zip, icon: "⊙", type: "zip" });
    });
    return suggestions.slice(0, 5);
  }

  // Category keywords
  let hasCategoryMatch = false;
  (Object.entries(CATEGORY_CONFIG) as [ResourceCategory, (typeof CATEGORY_CONFIG)[ResourceCategory]][])
    .forEach(([, cat]) => {
      if (cat.label.toLowerCase().includes(q) && !seen.has(cat.label)) {
        seen.add(cat.label);
        hasCategoryMatch = true;
        suggestions.push({ label: cat.label, sub: "category", value: cat.label, icon: cat.icon, type: "category" });
      }
    });

  // Cities — match plain city name OR "city state" / "city, state" patterns
  const cityMap = new Map<string, Resource>();
  resources.filter(r => {
    const c  = r.city.toLowerCase();
    const cs = `${r.city} ${r.state}`.toLowerCase();
    return c.includes(q) || cs.startsWith(q);
  }).forEach(r => {
    const key = `${r.city}, ${r.state}`;
    if (!cityMap.has(key)) cityMap.set(key, r);
  });
  cityMap.forEach((_, cityState) => {
    if (!seen.has(cityState)) {
      seen.add(cityState);
      suggestions.push({ label: cityState, sub: "city", value: cityState, icon: "⊙", type: "city" });
    }
  });

  // If nothing location-related matched in the DB, add a synthetic "search nearby" suggestion
  // so the user can still geocode any city name even with no local resources
  if (cityMap.size === 0 && !hasCategoryMatch && q.length >= 3) {
    suggestions.unshift({ label: query.trim(), sub: "search nearby", value: query.trim(), icon: "⊙", type: "city" });
  }

  // Resource names
  resources
    .filter(r => r.name.toLowerCase().includes(q))
    .slice(0, 4)
    .forEach(r => {
      if (!seen.has(r.name)) {
        seen.add(r.name);
        suggestions.push({
          label: r.name,
          sub: `${r.city}, ${r.state}`,
          value: r.name,
          icon: CATEGORY_CONFIG[r.category]?.icon,
          type: "resource",
        });
      }
    });

  return suggestions.slice(0, 6);
}

async function geocodeLocation(query: string): Promise<{ coords: [number, number]; relevance: number } | null> {
  try {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?types=place,postcode&country=US&access_token=${token}`;
    const res  = await fetch(url);
    const json = await res.json() as { features?: Array<{ center?: [number, number]; relevance?: number }> };
    const f    = json.features?.[0];
    if (f?.center && f.center.length === 2) return { coords: f.center, relevance: f.relevance ?? 0 };
  } catch { /* ignore */ }
  return null;
}

interface MapSearchInputProps {
  resources: Resource[];
  value: string;
  onSearch: (query: string) => void;
  onLocationSearch?: (coords: [number, number], label: string) => void;
  placeholder?: string;
  className?: string;
}

const SUB_KEY: Record<string, UIKey> = {
  "search nearby": "SUGG_NEARBY",
  "city":          "SUGG_CITY",
  "category":      "SUGG_CATEGORY",
};

export function MapSearchInput({
  resources,
  value,
  onSearch,
  onLocationSearch,
  placeholder,
  className,
}: MapSearchInputProps) {
  const t = useT();
  const [localValue, setLocalValue] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Sync when parent clears the value
  useEffect(() => { setLocalValue(value); }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setLocalValue(val);
    setActiveIdx(-1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSuggestions(getSuggestions(val, resources));
      setOpen(true);
      if (!val.trim()) onSearch("");
    }, 180);
  }

  async function commitText(val: string) {
    setLocalValue(val);
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.blur();

    const q = val.trim();
    if (!q) { onSearch(""); return; }

    // Zip code
    if (/^\d{5}$/.test(q) && onLocationSearch) {
      const result = await geocodeLocation(q);
      if (result) { onLocationSearch(result.coords, q); return; }
    }

    if (onLocationSearch) {
      // City name or "City STATE" / "City, STATE" — match against loaded resources first
      const normalized = q.toLowerCase().replace(/,\s*/g, " ").trim();
      const match = resources.find(r => {
        const c  = r.city.toLowerCase();
        const cs = `${r.city} ${r.state}`.toLowerCase();
        return c === normalized || cs === normalized;
      });
      if (match) {
        const label  = `${match.city}, ${match.state}`;
        const result = await geocodeLocation(label);
        if (result) { onLocationSearch(result.coords, label); return; }
      }

      // No resource match — try geocoding the raw query directly.
      // Only accept high-confidence results (≥ 0.5) so service keywords
      // like "shelter" don't accidentally fly to Shelter, MT.
      const fallback = await geocodeLocation(q);
      if (fallback && fallback.relevance >= 0.5) {
        onLocationSearch(fallback.coords, q);
        return;
      }
    }

    // Fall back to full-text resource search
    onSearch(val);
  }

  async function commitSuggestion(s: Suggestion) {
    setLocalValue(s.label);
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.blur();

    // City or zip → geocode and show nearest resources
    if ((s.type === "city" || s.type === "zip") && onLocationSearch) {
      const result = await geocodeLocation(s.value);
      if (result) {
        onLocationSearch(result.coords, s.label);
        return;
      }
    }
    // Category or resource name → full-text search
    onSearch(s.value);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        commitSuggestion(suggestions[activeIdx]);
      } else if (suggestions.length > 0) {
        commitSuggestion(suggestions[0]);
      } else {
        commitText(localValue);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      commitText("");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    }
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative flex items-center">
        <span className="absolute left-3 text-content-muted text-[13px] pointer-events-none" aria-hidden="true">
          ⌕
        </span>
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (localValue.length >= 2) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder ?? t("SEARCH_MAP_PLACEHOLDER")}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label="Search resources"
          aria-autocomplete="list"
          aria-expanded={open && suggestions.length > 0}
          // font-size ≥ 16px prevents iOS/Android from zooming on focus
          style={{ fontSize: 16 }}
          className="w-full bg-surface-0 border border-border rounded-lg pl-8 pr-8 py-2.5 font-mono text-content-primary placeholder-content-muted outline-none focus:border-accent transition-all shadow-md"
        />
        {localValue && (
          <button
            onMouseDown={e => { e.preventDefault(); commitText(""); setLocalValue(""); }}
            tabIndex={-1}
            className="absolute right-2.5 text-content-muted hover:text-content-primary text-[12px] w-5 h-5 flex items-center justify-center"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 bg-surface-0 border border-border rounded-lg overflow-hidden z-50 shadow-2xl"
        >
          {suggestions.map((s, i) => (
            <li key={i} role="option" aria-selected={i === activeIdx}>
              <button
                onMouseDown={e => { e.preventDefault(); commitSuggestion(s); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
                  i === activeIdx ? "bg-surface-2" : "hover:bg-surface-1",
                  i > 0 && "border-t border-border-subtle"
                )}
              >
                <span className="text-[13px] flex-shrink-0 w-5 text-center" aria-hidden="true">
                  {s.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="font-mono text-[12px] text-content-primary truncate block">{s.label}</span>
                  {s.sub && (
                    <span className="font-mono text-[9px] text-content-muted tracking-[0.06em] uppercase">
                      {SUB_KEY[s.sub] ? t(SUB_KEY[s.sub]) : s.sub}
                    </span>
                  )}
                </span>
                {(s.type === "city" || s.type === "zip") && (
                  <span className="font-mono text-[8px] text-accent tracking-[0.08em] flex-shrink-0">
                    {t("NEARBY")}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
