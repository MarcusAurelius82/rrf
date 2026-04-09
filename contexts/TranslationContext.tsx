"use client";
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { UI_STRINGS, UIKey } from "@/lib/ui-strings";
import staticTranslationsJson from "@/lib/ui-translations.json";

export { UI_STRINGS, type UIKey };

type TranslationMap = Map<UIKey, string>;
type TFunc = (key: UIKey) => string;

// Cast static JSON: { [langCode]: { [UIKey]: string } }
const staticData = staticTranslationsJson as Record<string, Record<string, string>>;

// Convert a language's static data to a Map once and cache it
const staticMaps = new Map<string, TranslationMap>();

function getStaticMap(lang: string): TranslationMap | null {
  if (staticMaps.has(lang)) return staticMaps.get(lang)!;
  const raw = staticData[lang];
  if (!raw) return null;
  const map = new Map<UIKey, string>(Object.entries(raw) as [UIKey, string][]);
  staticMaps.set(lang, map);
  return map;
}

// Runtime cache for languages not in the static file (fallback fetch)
const runtimeCache = new Map<string, TranslationMap>();

async function fetchTranslations(lang: string): Promise<TranslationMap> {
  if (runtimeCache.has(lang)) return runtimeCache.get(lang)!;

  const keys = Object.keys(UI_STRINGS) as UIKey[];
  const texts = keys.map((k) => UI_STRINGS[k]);

  try {
    const res = await fetch("/api/translate/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, target_lang: lang }),
    });
    const { data } = await res.json() as { data: { translations: string[] } };
    const map = new Map<UIKey, string>();
    keys.forEach((k, i) => map.set(k, data.translations[i] ?? UI_STRINGS[k]));
    runtimeCache.set(lang, map);
    return map;
  } catch {
    return new Map(); // caller falls back to English
  }
}

const TranslationContext = createContext<TFunc>((key) => UI_STRINGS[key]);

export function TranslationProvider({ lang, children }: { lang: string; children: ReactNode }) {
  const [translations, setTranslations] = useState<TranslationMap | null>(() =>
    lang !== "EN" ? getStaticMap(lang) : null
  );
  const currentLang = useRef(lang);

  useEffect(() => {
    currentLang.current = lang;

    if (lang === "EN") {
      setTranslations(null);
      return;
    }

    // Static file: instant, no API call
    const staticMap = getStaticMap(lang);
    if (staticMap) {
      setTranslations(staticMap);
      return;
    }

    // Fallback: runtime fetch for any language not yet in the static file
    fetchTranslations(lang).then((map) => {
      if (currentLang.current !== lang) return; // stale
      setTranslations(map.size ? map : null);
    });
  }, [lang]);

  const t: TFunc = (key) =>
    translations ? (translations.get(key) ?? UI_STRINGS[key]) : UI_STRINGS[key];

  return (
    <TranslationContext.Provider value={t}>
      {children}
    </TranslationContext.Provider>
  );
}

/** Returns the `t(key)` function for the nearest TranslationProvider. */
export function useT(): TFunc {
  return useContext(TranslationContext);
}
