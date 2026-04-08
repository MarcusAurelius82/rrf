"use client";
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";

// All static UI strings that need translation.
// Proper nouns (org names, addresses) are intentionally excluded.
export const UI_STRINGS = {
  // Categories
  ALL:              "ALL",
  SHELTER:          "SHELTER",
  FOOD:             "FOOD",
  LEGAL:            "LEGAL",
  MEDICAL:          "MEDICAL",
  LANGUAGE:         "LANGUAGE",
  // Status badges
  OPEN:             "OPEN",
  CLOSED:           "CLOSED",
  CLOSING_SOON:     "CLOSING SOON",
  APPT_ONLY:        "APPOINTMENT ONLY",
  // Urgency
  URGENT:           "URGENT",
  // Actions
  GET_DIRECTIONS:   "GET DIRECTIONS",
  REPORT_MISSING:   "+ Report Missing Resource",
  // Documentation badges
  NO_DOCS:          "NO DOCS REQUIRED",
  ID_ONLY:          "ID ONLY",
  LEGAL_STATUS:     "LEGAL STATUS REQUIRED",
  PROG_ELIGIBLE:    "PROGRAM ELIGIBILITY REQUIRED",
  CALL_AHEAD:       "CALL AHEAD — CONFIRM ELIGIBILITY",
  // Loading / empty states
  LOADING:          "LOADING...",
  NO_RESOURCES:     "NO RESOURCES FOUND",
  ZOOM_OUT:         "ZOOM OUT TO SEE",
  RESULT_S:         "RESULTS",
  RESULT_1:         "RESULT",
  SELECT_STATE:     "NO RESOURCES — SELECT A STATE ON THE MAP",
  OUTSIDE_VIEW:     "resources outside current view",
  // Panel labels
  LOCAL_RESOURCES:  "LOCAL RESOURCES",
  CRISIS_SUPPORT:   "CRISIS SUPPORT",
  EMERGENCY_SVCS:   "EMERGENCY SERVICES",
  REFUGEE_HOTLINE:  "REFUGEE HOTLINE",
  // Doc filter buttons
  ALL_RESOURCES:    "ALL RESOURCES",
  // Sidebar
  FILTERS:          "FILTERS",
  SUPPORT:          "SUPPORT",
  FAQ:              "FAQ",
} as const;

export type UIKey = keyof typeof UI_STRINGS;

// Module-level cache: lang code → translated map (persists across re-renders)
const langCache = new Map<string, Map<UIKey, string>>();

type TFunc = (key: UIKey) => string;

const TranslationContext = createContext<TFunc>((key) => UI_STRINGS[key]);

export function TranslationProvider({ lang, children }: { lang: string; children: ReactNode }) {
  const [translations, setTranslations] = useState<Map<UIKey, string> | null>(null);
  const currentLang = useRef(lang);

  useEffect(() => {
    currentLang.current = lang;

    if (lang === "EN") {
      setTranslations(null);
      return;
    }

    // Return cached result immediately if available
    if (langCache.has(lang)) {
      setTranslations(langCache.get(lang)!);
      return;
    }

    // Batch-translate all UI strings in one request
    const keys = Object.keys(UI_STRINGS) as UIKey[];
    const texts = keys.map((k) => UI_STRINGS[k]);

    fetch("/api/translate/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, target_lang: lang }),
    })
      .then((r) => r.json())
      .then(({ data }: { data: { translations: string[] } }) => {
        if (currentLang.current !== lang) return; // stale response — discard
        const map = new Map<UIKey, string>();
        keys.forEach((k, i) => {
          map.set(k, data.translations[i] ?? UI_STRINGS[k]);
        });
        langCache.set(lang, map);
        setTranslations(map);
      })
      .catch(() => {
        // Graceful fallback to English
        setTranslations(null);
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
