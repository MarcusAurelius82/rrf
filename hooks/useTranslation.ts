"use client";
import { useState, useEffect, useCallback, useRef } from "react";

// In-memory cache shared across all hook instances in the same page session.
// Keyed by `${lang}:${text}` → translated string.
const memCache = new Map<string, string>();

function cacheKey(lang: string, text: string) {
  return `${lang}:${text}`;
}

async function translateBatch(texts: string[], lang: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const toFetch: string[] = [];

  for (const text of texts) {
    const k = cacheKey(lang, text);
    if (memCache.has(k)) {
      result.set(text, memCache.get(k)!);
    } else {
      toFetch.push(text);
    }
  }

  if (!toFetch.length) return result;

  try {
    // Batch all untranslated strings in a single API call
    const res = await fetch("/api/translate/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: toFetch, target_lang: lang }),
    });
    if (!res.ok) throw new Error("translate failed");
    const { data } = await res.json() as { data: { translations: string[] } };
    data.translations.forEach((t, i) => {
      memCache.set(cacheKey(lang, toFetch[i]), t);
      result.set(toFetch[i], t);
    });
  } catch {
    // Fall back to original text on error
    toFetch.forEach(t => result.set(t, t));
  }

  return result;
}

/**
 * Hook that translates an array of strings into the target language.
 * Returns translated strings in the same order; falls back to originals
 * while loading or on error. EN is a no-op.
 */
export function useTranslation(texts: string[], lang: string): string[] {
  const [translated, setTranslated] = useState<string[]>(texts);
  const prevLang  = useRef(lang);
  const prevTexts = useRef(texts);

  useEffect(() => {
    if (lang === "EN") {
      setTranslated(texts);
      return;
    }

    // If nothing changed, skip
    const textsChanged = texts.some((t, i) => t !== prevTexts.current[i]) || texts.length !== prevTexts.current.length;
    if (!textsChanged && lang === prevLang.current) return;
    prevLang.current  = lang;
    prevTexts.current = texts;

    let cancelled = false;
    translateBatch(texts, lang).then(map => {
      if (cancelled) return;
      setTranslated(texts.map(t => map.get(t) ?? t));
    });
    return () => { cancelled = true; };
  }, [texts, lang]);

  // Always return originals synchronously on first render
  return lang === "EN" ? texts : translated;
}

/**
 * Simple single-string translation hook.
 */
export function useT(text: string, lang: string): string {
  const [result] = useTranslation([text], lang);
  return result;
}
