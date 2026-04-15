/**
 * All static UI strings that need translation.
 * Imported by TranslationContext (client) and generate-ui-translations script (Node).
 * Proper nouns — org names, addresses, phone numbers — are intentionally excluded.
 */
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
  // Search
  SEARCH_PLACEHOLDER:     "Search resources…",
  SEARCH_MAP_PLACEHOLDER: "Search shelter, food, legal aid…",
  NEARBY:                 "NEARBY",
  SUGG_NEARBY:            "search nearby",
  SUGG_CITY:              "city",
  SUGG_CATEGORY:          "category",
} as const;

export type UIKey = keyof typeof UI_STRINGS;
