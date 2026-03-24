"use client";
import { useState } from "react";
import { Resource } from "@/types";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Resource[] | null>(null);
  const [aiSummary, setAiSummary] = useState<string | undefined>();
  const [isSearching, setIsSearching] = useState(false);

  async function search(q: string, state?: string | null) {
    if (!q.trim()) { clear(); return; }
    setIsSearching(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, state }),
      });
      const { data } = await res.json();
      setResults(data?.resources ?? []);
      setAiSummary(data?.ai_summary);
    } catch {
      // silently fail
    } finally {
      setIsSearching(false);
    }
  }

  function clear() {
    setQuery("");
    setResults(null);
    setAiSummary(undefined);
  }

  return { query, setQuery, results, aiSummary, isSearching, search, clear };
}
