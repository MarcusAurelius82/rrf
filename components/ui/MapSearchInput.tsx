"use client";
import { useState, useRef, useEffect } from "react";
import { Resource, ResourceCategory } from "@/types";
import { CATEGORY_CONFIG, cn } from "@/lib/utils";

interface Suggestion {
  label: string;
  sub?: string;
  value: string;
  icon?: string;
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
      suggestions.push({ label: zip, sub: `${r.city}, ${r.state}`, value: zip, icon: "⊙" });
    });
    return suggestions.slice(0, 5);
  }

  // Category keywords
  (Object.entries(CATEGORY_CONFIG) as [ResourceCategory, (typeof CATEGORY_CONFIG)[ResourceCategory]][])
    .forEach(([, cat]) => {
      if (cat.label.toLowerCase().includes(q) && !seen.has(cat.label)) {
        seen.add(cat.label);
        suggestions.push({ label: cat.label, sub: "category", value: cat.label, icon: cat.icon });
      }
    });

  // Cities
  const cityMap = new Map<string, Resource>();
  resources.filter(r => r.city.toLowerCase().includes(q)).forEach(r => {
    const key = `${r.city}, ${r.state}`;
    if (!cityMap.has(key)) cityMap.set(key, r);
  });
  cityMap.forEach((_, cityState) => {
    if (!seen.has(cityState)) {
      seen.add(cityState);
      suggestions.push({ label: cityState, sub: "city", value: cityState, icon: "⊙" });
    }
  });

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
        });
      }
    });

  return suggestions.slice(0, 6);
}

interface MapSearchInputProps {
  resources: Resource[];
  value: string;
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export function MapSearchInput({
  resources,
  value,
  onSearch,
  placeholder,
  className,
}: MapSearchInputProps) {
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

  function commit(val: string) {
    setLocalValue(val);
    setSuggestions([]);
    setOpen(false);
    onSearch(val);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(activeIdx >= 0 ? (suggestions[activeIdx]?.value ?? localValue) : localValue);
    } else if (e.key === "Escape") {
      setOpen(false);
      commit("");
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
          placeholder={placeholder ?? "Search resources…"}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label="Search resources"
          aria-autocomplete="list"
          aria-expanded={open && suggestions.length > 0}
          // font-size ≥ 16px prevents iOS/Android from zooming on focus
          style={{ fontSize: 16 }}
          className="w-full bg-surface-0/95 backdrop-blur-sm border border-border rounded-lg pl-8 pr-8 py-2.5 font-mono text-content-primary placeholder-content-muted outline-none focus:border-accent transition-all"
        />
        {localValue && (
          <button
            onMouseDown={e => { e.preventDefault(); commit(""); setLocalValue(""); }}
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
          className="absolute top-full left-0 right-0 mt-1 bg-surface-0 border border-border rounded-lg overflow-hidden z-50 shadow-xl"
        >
          {suggestions.map((s, i) => (
            <li key={i} role="option" aria-selected={i === activeIdx}>
              <button
                onMouseDown={e => { e.preventDefault(); commit(s.value); }}
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
                      {s.sub}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
