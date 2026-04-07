"use client";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  onSearch?: (val: string) => void;
  placeholder?: string;
  aiEnabled?: boolean;
  className?: string;
  debounceMs?: number;
}

export function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder,
  aiEnabled,
  className,
  debounceMs = 300,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Sync when parent clears the value externally
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setLocalValue(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(val), debounceMs);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      clearTimeout(debounceRef.current);
      onChange(localValue);
      onSearch?.(localValue);
    }
    if (e.key === "Escape") {
      setLocalValue("");
      onChange("");
    }
  }

  const label = placeholder ?? "Search resources";

  return (
    <div className={cn("relative flex items-center", className)}>
      <label className="sr-only" htmlFor="search-input">{label}</label>
      <input
        id="search-input"
        type="search"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Search..."}
        aria-label={label}
        autoComplete="off"
        style={{ fontSize: 16 }}
        className="w-full bg-[#111] border border-white/[0.08] rounded-md px-3 py-2 font-mono text-white placeholder-[#444] outline-none focus:border-white/20 focus-visible:ring-1 focus-visible:ring-white/20 transition-all pr-16"
      />
      {aiEnabled && (
        <div
          className="absolute right-2 flex items-center gap-1 pointer-events-none"
          aria-hidden="true"
          title="AI-powered search"
        >
          <span className="w-1 h-1 rounded-full bg-[#2563eb] animate-pulse" />
          <span className="font-mono text-[8px] text-[#2563eb] tracking-[0.08em]">AI</span>
        </div>
      )}
    </div>
  );
}
