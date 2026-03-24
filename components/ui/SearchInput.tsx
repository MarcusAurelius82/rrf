"use client";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  onSearch?: (val: string) => void;
  placeholder?: string;
  aiEnabled?: boolean;
  className?: string;
}

export function SearchInput({ value, onChange, onSearch, placeholder, aiEnabled, className }: SearchInputProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") onSearch?.(value);
  }

  return (
    <div className={cn("relative flex items-center", className)}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Search..."}
        className="w-full bg-[#111] border border-white/[0.08] rounded-md px-3 py-2 font-mono text-[11px] text-white placeholder-[#444] outline-none focus:border-white/20 transition-all pr-16"
      />
      {aiEnabled && (
        <div className="absolute right-2 flex items-center gap-1 pointer-events-none">
          <span className="w-1 h-1 rounded-full bg-[#2563eb] animate-pulse" />
          <span className="font-mono text-[8px] text-[#2563eb] tracking-[0.08em]">AI</span>
        </div>
      )}
    </div>
  );
}
