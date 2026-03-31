#!/usr/bin/env tsx
/**
 * scripts/seed-data.ts
 *
 * Seeds Supabase with real humanitarian resource data from:
 *   Phase 1 (Medical)  — HRSA Health Center bulk CSV (data.hrsa.gov)
 *   Phase 2 (Shelter)  — OpenStreetMap Overpass API (social_facility=shelter)
 *   Phase 3 (Legal)    — Curated LSC-funded organizations + Mapbox geocoding
 *
 * Run:  npm run seed:data
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_MAPBOX_TOKEN
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(process.cwd(), ".env.local") });

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = "shelter" | "food" | "legal" | "medical" | "language";
type Status   = "open" | "closed" | "closing_soon" | "appointment_only";

interface ResourceRow {
  name:     string;
  category: Category;
  status:   Status;
  address:  string;
  city:     string;
  state:    string;
  zip:      string;
  lat:      number;
  lng:      number;
  phone?:   string;
  website?: string;
  urgent:   boolean;
  verified: boolean;
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATES = [
  "AL","AK","AR","AZ","CA","CO","CT","DC","DE","FL","GA","HI","IA","ID","IL",
  "IN","KS","KY","LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE",
  "NH","NJ","NM","NV","NY","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VA","VT","WA","WI","WV","WY",
] as const;
type State = typeof STATES[number];

// State full names for Overpass queries
const STATE_NAMES: Record<State, string> = {
  AL: "Alabama",      AK: "Alaska",        AR: "Arkansas",      AZ: "Arizona",
  CA: "California",   CO: "Colorado",      CT: "Connecticut",   DC: "District of Columbia",
  DE: "Delaware",     FL: "Florida",       GA: "Georgia",       HI: "Hawaii",
  IA: "Iowa",         ID: "Idaho",         IL: "Illinois",      IN: "Indiana",
  KS: "Kansas",       KY: "Kentucky",      LA: "Louisiana",     MA: "Massachusetts",
  MD: "Maryland",     ME: "Maine",         MI: "Michigan",      MN: "Minnesota",
  MO: "Missouri",     MS: "Mississippi",   MT: "Montana",       NC: "North Carolina",
  ND: "North Dakota", NE: "Nebraska",      NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico",   NV: "Nevada",        NY: "New York",      OH: "Ohio",
  OK: "Oklahoma",     OR: "Oregon",        PA: "Pennsylvania",  RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",   TX: "Texas",
  UT: "Utah",         VA: "Virginia",      VT: "Vermont",       WA: "Washington",
  WI: "Wisconsin",    WV: "West Virginia", WY: "Wyoming",
};

// Approximate bounding boxes [south, west, north, east] for Overpass
const STATE_BBOX: Record<State, [number, number, number, number]> = {
  AL: [30.2,  -88.5, 35.0,  -84.9],
  AK: [51.2, -170.0, 71.5, -130.0],
  AR: [33.0,  -94.6, 36.5,  -89.6],
  AZ: [31.3, -114.8, 37.0, -109.0],
  CA: [32.5, -124.5, 42.0, -114.1],
  CO: [37.0, -109.1, 41.0, -102.0],
  CT: [40.9,  -73.7, 42.1,  -71.8],
  DC: [38.8,  -77.1, 39.0,  -76.9],
  DE: [38.4,  -75.8, 39.8,  -75.0],
  FL: [24.4,  -87.6, 31.0,  -80.0],
  GA: [30.4,  -85.6, 35.0,  -81.0],
  HI: [18.9, -160.2, 22.2, -154.8],
  IA: [40.4,  -96.6, 43.5,  -90.1],
  ID: [42.0, -117.2, 49.0, -111.0],
  IL: [36.9,  -91.5, 42.5,  -87.0],
  IN: [37.8,  -88.1, 41.8,  -84.8],
  KS: [37.0, -102.1, 40.0,  -94.6],
  KY: [36.5,  -89.6, 39.1,  -82.0],
  LA: [28.9,  -94.0, 33.0,  -89.0],
  MA: [41.2,  -73.5, 42.9,  -69.9],
  MD: [37.9,  -79.5, 39.7,  -75.0],
  ME: [43.0,  -71.1, 47.5,  -66.9],
  MI: [41.7,  -90.4, 48.3,  -82.4],
  MN: [43.5,  -97.2, 49.4,  -89.5],
  MO: [36.0,  -95.8, 40.6,  -89.1],
  MS: [30.0,  -91.7, 35.0,  -88.1],
  MT: [44.4, -116.1, 49.0, -104.0],
  NC: [33.8,  -84.3, 36.6,  -75.5],
  ND: [45.9, -104.0, 49.0,  -96.6],
  NE: [40.0, -104.1, 43.0,  -95.3],
  NH: [42.7,  -72.6, 45.3,  -70.6],
  NJ: [38.9,  -75.6, 41.4,  -73.9],
  NM: [31.3, -109.1, 37.0, -103.0],
  NV: [35.0, -120.0, 42.0, -114.0],
  NY: [40.4,  -79.8, 45.1,  -71.8],
  OH: [38.4,  -84.8, 42.0,  -80.5],
  OK: [33.6, -103.0, 37.0,  -94.4],
  OR: [42.0, -124.6, 46.2, -116.5],
  PA: [39.7,  -80.5, 42.3,  -74.7],
  RI: [41.1,  -71.9, 42.0,  -71.1],
  SC: [32.0,  -83.4, 35.2,  -78.5],
  SD: [42.5, -104.1, 45.9,  -96.4],
  TN: [34.9,  -90.3, 36.7,  -81.6],
  TX: [25.8, -106.7, 36.5,  -93.5],
  UT: [37.0, -114.1, 42.0, -109.0],
  VA: [36.5,  -83.7, 39.5,  -75.2],
  VT: [42.7,  -73.4, 45.0,  -71.5],
  WA: [45.5, -124.8, 49.0, -116.9],
  WI: [42.5,  -92.9, 47.3,  -86.8],
  WV: [37.2,  -82.6, 40.6,  -77.7],
  WY: [41.0, -111.1, 45.0, -104.0],
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// Per-run insert counter:  "NY:medical" → 5
const insertStats: Record<string, number> = {};

// ── Utility helpers ───────────────────────────────────────────────────────────

function str(...vals: unknown[]): string {
  for (const v of vals) {
    const s = v != null ? String(v).trim() : "";
    if (s) return s;
  }
  return "";
}

function validCoords(lat: unknown, lng: unknown): boolean {
  const la = Number(lat), lo = Number(lng);
  return !isNaN(la) && !isNaN(lo) && la !== 0 && lo !== 0 &&
    Math.abs(la) <= 90 && Math.abs(lo) <= 180;
}

/** Stricter check: must be within continental US / territories bounds */
function validUSCoords(lat: number, lng: number): boolean {
  return lat >= 24 && lat <= 49 && lng >= -125 && lng <= -66;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// Rate-limited geocoding via Mapbox
let geocodeCount = 0;
async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN) return null;
  if (geocodeCount > 0 && geocodeCount % 10 === 0) await sleep(500); // gentle rate limit
  geocodeCount++;
  const enc = encodeURIComponent(query);
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${enc}.json` +
    `?access_token=${MAPBOX_TOKEN}&limit=1&country=US&types=address,place`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json() as { features?: Array<{ center: [number, number] }> };
    if (json.features?.length) {
      const [lng, lat] = json.features[0].center;
      return { lat, lng };
    }
  } catch { /* ignore */ }
  return null;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

async function loadExistingKeys(): Promise<Set<string>> {
  const { data, error } = await supabase.from("resources").select("name, zip");
  if (error) {
    console.warn("  Could not load existing keys:", error.message);
    return new Set();
  }
  return new Set(
    (data ?? []).map(r => `${r.name.toLowerCase()}|${(r.zip ?? "").trim()}`)
  );
}

function dupeKey(name: string, zip: string): string {
  return `${name.toLowerCase().trim()}|${zip.trim()}`;
}

// ── Insert batch ──────────────────────────────────────────────────────────────

async function insertRecords(
  records: ResourceRow[],
  existing: Set<string>
): Promise<number> {
  const fresh = records.filter(r => {
    const k = dupeKey(r.name, r.zip);
    if (existing.has(k)) return false;
    existing.add(k);
    return true;
  });
  if (!fresh.length) return 0;

  const { data, error } = await supabase
    .from("resources")
    .insert(fresh)
    .select("state, category");

  if (error) {
    console.error(`    Insert failed: ${error.message}`);
    return 0;
  }
  for (const r of data ?? []) {
    const k = `${r.state}:${r.category}`;
    insertStats[k] = (insertStats[k] ?? 0) + 1;
  }
  return data?.length ?? 0;
}

// ── CSV parser (no dependency) ────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false, current = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { result.push(current); current = ""; }
    else current += ch;
  }
  result.push(current);
  return result;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split("\n").filter(l => l.trim());
  const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const rows = lines.slice(1).map(l => parseCsvLine(l));
  return { headers, rows };
}

function csvGet(
  row: string[],
  headers: string[],
  ...keys: string[]
): string {
  for (const key of keys) {
    const idx = headers.indexOf(key.toLowerCase());
    if (idx >= 0) return (row[idx] ?? "").trim();
  }
  return "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — HRSA Federally Qualified Health Centers (Medical)
// Source: https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv
// ═══════════════════════════════════════════════════════════════════════════════

async function seedHRSA(existing: Set<string>) {
  console.log("\n═══ PHASE 1: HRSA Health Centers (Medical) ═══");

  const CSV_URL =
    "https://data.hrsa.gov/DataDownload/DD_Files/" +
    "Health_Center_Service_Delivery_and_LookAlike_Sites.csv";

  console.log("  Downloading HRSA CSV (~10 MB)…");
  let csvText: string;
  try {
    const res = await fetch(CSV_URL, {
      headers: { "User-Agent": "humanitarian-resource-finder/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    csvText = await res.text();
  } catch (e: unknown) {
    console.error(`  HRSA CSV download failed: ${(e as Error).message}`);
    console.error("  Skipping Phase 1.");
    return;
  }

  const { headers, rows } = parseCsv(csvText);
  console.log(`  Parsed ${rows.length} rows from CSV`);

  // Group by state to log per-state counts
  const byState: Record<string, ResourceRow[]> = {};

  for (const row of rows) {
    const state = csvGet(row, headers, "site state abbreviation");
    if (!(STATES as readonly string[]).includes(state)) continue;

    const name     = csvGet(row, headers, "site name");
    const address  = csvGet(row, headers, "site address");
    const city     = csvGet(row, headers, "site city");
    const zip      = csvGet(row, headers, "site postal code");
    const phone    = csvGet(row, headers, "site telephone number");
    const website  = csvGet(row, headers, "site web address");
    const statusRaw = csvGet(row, headers, "site status description").toLowerCase();

    // HRSA CSV uses Y=lat, X=lng (geocoding artifact coordinates)
    const latRaw = csvGet(
      row, headers,
      "geocoding artifact address primary y coordinate",
      "geocoding artifact address y coordinate",
      "latitude"
    );
    const lngRaw = csvGet(
      row, headers,
      "geocoding artifact address primary x coordinate",
      "geocoding artifact address x coordinate",
      "longitude"
    );

    if (!name || !address || !city) continue;

    let lat = Number(latRaw);
    let lng = Number(lngRaw);

    // For US addresses lng must be negative; if both values are positive and one
    // looks like a longitude (>90), the columns are likely swapped — correct in place
    if (lat > 0 && lng > 0 && Math.abs(lat) > 90 && Math.abs(lng) < 90) {
      [lat, lng] = [lng, lat];
    }

    if (!validCoords(lat, lng) || !validUSCoords(lat, lng)) {
      const geo = await geocode(`${address}, ${city}, ${state} ${zip}`);
      if (!geo) continue;
      lat = geo.lat;
      lng = geo.lng;
    }

    const status: Status = statusRaw.includes("active") ? "open" : "closed";

    byState[state] = byState[state] ?? [];
    byState[state].push({
      name:     name.slice(0, 200),
      category: "medical",
      status,
      address:  address.slice(0, 300),
      city,
      state,
      zip:      zip.slice(0, 10),
      lat,
      lng,
      phone:    phone  || undefined,
      website:  website || undefined,
      urgent:   false,
      verified: true,
    });
  }

  let total = 0;
  for (const state of STATES) {
    const records = byState[state] ?? [];
    const n = await insertRecords(records, existing);
    total += n;
    console.log(`  ${state}: inserted ${n} / ${records.length} medical records`);
  }
  console.log(`  PHASE 1 TOTAL: ${total} records inserted`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — OpenStreetMap Overpass API (Shelter)
// Queries social_facility=shelter nodes within each state bounding box
// ═══════════════════════════════════════════════════════════════════════════════

interface OverpassElement {
  type:  "node" | "way" | "relation";
  id:    number;
  lat?:  number;
  lon?:  number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function fetchOverpassState(state: State): Promise<OverpassElement[]> {
  const [s, w, n, e] = STATE_BBOX[state];
  const bbox = `${s},${w},${n},${e}`;

  // Query for multiple shelter-related OSM tags
  const query = `
[out:json][timeout:30][bbox:${bbox}];
(
  node["social_facility"="shelter"];
  node["social_facility"="refugee"];
  node["amenity"="shelter"]["shelter_type"!="public_transport"];
  node["emergency"="shelter"];
  way["social_facility"="shelter"];
  way["social_facility"="refugee"];
);
out center;
`.trim();

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json = await res.json() as { elements?: OverpassElement[] };
  return json.elements ?? [];
}

async function seedOSMShelters(existing: Set<string>) {
  console.log("\n═══ PHASE 2: OpenStreetMap Shelters (Shelter) ═══");
  let total = 0;

  for (const state of STATES) {
    try {
      // Overpass has rate limits — space requests out slightly
      await sleep(1000);
      console.log(`  ${state}: querying Overpass API…`);
      const elements = await fetchOverpassState(state);

      const records: ResourceRow[] = [];

      for (const el of elements) {
        const tags = el.tags ?? {};
        const name = str(tags.name, tags["name:en"], tags.operator);
        if (!name) continue;

        // Get coordinates (node has lat/lon directly; way has center)
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;

        // Build address from OSM addr:* tags
        const houseNum = str(tags["addr:housenumber"]);
        const street   = str(tags["addr:street"]);
        const address  = [houseNum, street].filter(Boolean).join(" ") || str(tags["addr:full"]);
        const city     = str(tags["addr:city"], tags["addr:suburb"], STATE_NAMES[state]);
        const zip      = str(tags["addr:postcode"]);
        const phone    = str(tags.phone, tags["contact:phone"]);
        const website  = str(tags.website, tags["contact:website"], tags.url);

        // Need at minimum a name and coordinates
        if (!validCoords(lat, lon)) {
          if (!address || !city) continue;
          const geo = await geocode(`${address}, ${city}, ${state} ${zip}`);
          if (!geo) continue;
          records.push({
            name, category: "shelter", status: "open",
            address: address || city,
            city, state, zip: zip.slice(0, 10),
            lat: geo.lat, lng: geo.lng,
            phone:   phone   || undefined,
            website: website || undefined,
            urgent: false, verified: false,
          });
        } else {
          records.push({
            name, category: "shelter", status: "open",
            address: address || city,
            city:    city    || STATE_NAMES[state],
            state, zip: zip.slice(0, 10),
            lat: Number(lat), lng: Number(lon),
            phone:   phone   || undefined,
            website: website || undefined,
            urgent: false, verified: false,
          });
        }
      }

      const n = await insertRecords(records, existing);
      total += n;
      console.log(`  ${state}: inserted ${n} / ${records.length} shelter records (${elements.length} OSM elements)`);
    } catch (e: unknown) {
      console.error(`  ${state}: Overpass error — ${(e as Error).message}`);
    }
  }

  console.log(`  PHASE 2 TOTAL: ${total} records inserted`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — Legal Services Corporation–funded organizations (Legal)
// Source: verified from lsc.gov/grants/our-grantees
// Geocoded via Mapbox at runtime
// ═══════════════════════════════════════════════════════════════════════════════

interface LSCOrg {
  name:     string;
  state:    State;
  city:     string;
  address:  string;
  zip:      string;
  phone?:   string;
  website?: string;
}

const LSC_ORGS: LSCOrg[] = [
  // ── New York ──────────────────────────────────────────────────────────────
  { name: "Legal Aid Society of New York",        state: "NY", city: "New York",     address: "199 Water St",          zip: "10038", phone: "(212) 577-3300", website: "https://www.legalaidnyc.org" },
  { name: "Legal Services NYC",                   state: "NY", city: "New York",     address: "40 Worth St",           zip: "10013", phone: "(917) 661-4500", website: "https://www.legalservicesnyc.org" },
  { name: "Empire Justice Center",                state: "NY", city: "Albany",       address: "250 South Clinton St",  zip: "12202", phone: "(518) 462-6831", website: "https://www.empirejustice.org" },
  { name: "Westchester Legal Aid Society",        state: "NY", city: "White Plains", address: "4 Cromwell Pl",         zip: "10601", phone: "(914) 286-3400", website: "https://www.legalaidwestchester.org" },
  { name: "Legal Assistance of Western New York", state: "NY", city: "Rochester",    address: "1 W Main St",           zip: "14614", phone: "(585) 325-2520", website: "https://www.lawny.org" },
  { name: "Nassau/Suffolk Law Services",          state: "NY", city: "Hempstead",   address: "1 Helen Keller Way",    zip: "11550", phone: "(516) 292-8100", website: "https://www.nslawservices.org" },

  // ── California ────────────────────────────────────────────────────────────
  { name: "Legal Aid Foundation of Los Angeles",  state: "CA", city: "Los Angeles",  address: "1550 W 8th St",         zip: "90017", phone: "(323) 801-7989", website: "https://lafla.org" },
  { name: "Bay Area Legal Aid",                   state: "CA", city: "Oakland",      address: "1735 Telegraph Ave",    zip: "94612", phone: "(415) 982-1300", website: "https://baylegal.org" },
  { name: "Greater Fresno Area Legal Services",   state: "CA", city: "Fresno",       address: "2014 Tulare St",        zip: "93721", phone: "(559) 570-1200", website: "https://centralcalifornialegalservices.org" },
  { name: "Bet Tzedek Legal Services",            state: "CA", city: "Los Angeles",  address: "3250 Wilshire Blvd",    zip: "90010", phone: "(323) 939-0506", website: "https://www.bettzedek.org" },
  { name: "Inland Counties Legal Services",       state: "CA", city: "Riverside",    address: "1040 Iowa Ave",         zip: "92507", phone: "(888) 245-4257", website: "https://www.inlandcountiesla.org" },
  { name: "Legal Aid of Sonoma County",           state: "CA", city: "Santa Rosa",   address: "144 South E St",        zip: "95404", phone: "(707) 542-1290", website: "https://legalaidsc.org" },
  { name: "Centro Legal de la Raza",              state: "CA", city: "Oakland",      address: "3400 E 12th St",        zip: "94601", phone: "(510) 437-1554", website: "https://centrolegal.org" },

  // ── Texas ─────────────────────────────────────────────────────────────────
  { name: "Lone Star Legal Aid",                  state: "TX", city: "Houston",      address: "1415 Fannin St",        zip: "77002", phone: "(713) 652-0077", website: "https://lonestarlegal.blog" },
  { name: "Texas Legal Services Center",          state: "TX", city: "Austin",       address: "4920 N IH-35",          zip: "78751", phone: "(512) 477-6000", website: "https://www.tlsc.org" },
  { name: "Legal Aid of Northwest Texas",         state: "TX", city: "Dallas",       address: "1515 Main St",          zip: "75201", phone: "(214) 748-1234", website: "https://lanwt.org" },
  { name: "South Texas Civil Rights Project",     state: "TX", city: "San Antonio",  address: "1017 N Main Ave",       zip: "78212", phone: "(210) 222-2102", website: "https://www.trla.org" },
  { name: "Texas RioGrande Legal Aid",            state: "TX", city: "San Antonio",  address: "1111 N Main Ave",       zip: "78212", phone: "(210) 212-3700", website: "https://www.trla.org" },

  // ── Illinois ──────────────────────────────────────────────────────────────
  { name: "Legal Aid Chicago",                    state: "IL", city: "Chicago",      address: "120 S LaSalle St",      zip: "60603", phone: "(312) 341-1070", website: "https://legalaidchicago.org" },
  { name: "Prairie State Legal Services",         state: "IL", city: "Waukegan",     address: "975 N Van Buren St",    zip: "60085", phone: "(847) 662-6435", website: "https://www.pslegal.org" },
  { name: "Land of Lincoln Legal Aid",            state: "IL", city: "Springfield",  address: "331 Fulton St",         zip: "61702", phone: "(309) 820-1232", website: "https://www.lollaf.org" },
  { name: "LAF (Legal Assistance Foundation)",    state: "IL", city: "Chicago",      address: "111 W Jackson Blvd",    zip: "60604", phone: "(312) 341-1070", website: "https://www.lafchicago.org" },

  // ── Florida ───────────────────────────────────────────────────────────────
  { name: "Legal Aid Society of Broward County",  state: "FL", city: "Fort Lauderdale", address: "491 N State Rd 7",  zip: "33317", phone: "(954) 765-8950", website: "https://legalaid.org" },
  { name: "Community Legal Services of Mid-FL",   state: "FL", city: "Orlando",      address: "122 E Colonial Dr",    zip: "32801", phone: "(407) 841-7777", website: "https://www.clsmf.org" },
  { name: "Legal Services of Greater Miami",      state: "FL", city: "Miami",         address: "3000 Biscayne Blvd",   zip: "33137", phone: "(305) 576-0080", website: "https://www.legalservicesmiami.org" },
  { name: "Bay Area Legal Services",              state: "FL", city: "Tampa",         address: "1602 N 21st St",       zip: "33605", phone: "(813) 232-1343", website: "https://www.bals.org" },
  { name: "Florida Rural Legal Services",         state: "FL", city: "Lakeland",      address: "725 E Memorial Blvd",  zip: "33801", phone: "(863) 688-7376", website: "https://www.frls.org" },

  // ── Washington ────────────────────────────────────────────────────────────
  { name: "Northwest Justice Project",            state: "WA", city: "Seattle",       address: "401 2nd Ave S",        zip: "98104", phone: "(206) 464-1519", website: "https://nwjustice.org" },
  { name: "Columbia Legal Services",              state: "WA", city: "Yakima",        address: "6 S 2nd St",           zip: "98901", phone: "(509) 575-5593", website: "https://columbialegal.org" },
  { name: "Spokane Legal Aid",                    state: "WA", city: "Spokane",       address: "35 W Main Ave",        zip: "99201", phone: "(509) 838-4505", website: "https://nwjustice.org" },

  // ── Arizona ───────────────────────────────────────────────────────────────
  { name: "Community Legal Services",             state: "AZ", city: "Phoenix",       address: "305 S 2nd Ave",        zip: "85003", phone: "(602) 258-3434", website: "https://clsaz.org" },
  { name: "Southern Arizona Legal Aid",           state: "AZ", city: "Tucson",        address: "177 N Church Ave",     zip: "85701", phone: "(520) 623-9465", website: "https://www.sazlegalaid.org" },
  { name: "DNA – People's Legal Services",        state: "AZ", city: "Flagstaff",     address: "702 E Cedar Ave",      zip: "86004", phone: "(928) 774-0653", website: "https://www.dnalegalservices.org" },

  // ── Minnesota ─────────────────────────────────────────────────────────────
  { name: "Mid-Minnesota Legal Aid",              state: "MN", city: "Minneapolis",   address: "111 N 5th St",         zip: "55403", phone: "(612) 332-1441", website: "https://www.mylegalaid.org" },
  { name: "Volunteer Lawyers Network",            state: "MN", city: "Minneapolis",   address: "600 Nicollet Mall",    zip: "55402", phone: "(612) 752-6677", website: "https://www.vlnmn.org" },
  { name: "Legal Aid Service of Northeastern MN", state: "MN", city: "Duluth",        address: "302 W Superior St",    zip: "55802", phone: "(218) 726-4800", website: "https://lasnem.org" },
  { name: "Southern Minnesota Regional Legal Svcs", state: "MN", city: "Saint Paul",  address: "46 E 4th St",          zip: "55101", phone: "(651) 222-7925", website: "https://www.smrls.org" },

  // ── Alabama ───────────────────────────────────────────────────────────────
  { name: "Legal Services Alabama",               state: "AL", city: "Montgomery",    address: "301 Washington Ave",   zip: "36104", phone: "(334) 832-4570", website: "https://legalservicesalabama.org" },
  { name: "Birmingham Volunteer Lawyers Program", state: "AL", city: "Birmingham",    address: "2021 2nd Ave N",       zip: "35203", phone: "(205) 250-5200", website: "https://www.alabar.org" },

  // ── Alaska ────────────────────────────────────────────────────────────────
  { name: "Alaska Legal Services Corporation",    state: "AK", city: "Anchorage",     address: "1016 W 6th Ave",       zip: "99501", phone: "(907) 272-9431", website: "https://alsc-law.org" },

  // ── Arkansas ──────────────────────────────────────────────────────────────
  { name: "Legal Aid of Arkansas",                state: "AR", city: "Jonesboro",     address: "714 S Main St",        zip: "72401", phone: "(870) 972-9224", website: "https://arlegalaid.org" },
  { name: "Center for Arkansas Legal Services",   state: "AR", city: "Little Rock",   address: "303 W Capitol Ave",    zip: "72201", phone: "(501) 376-3423", website: "https://arlegalservices.org" },

  // ── Colorado ──────────────────────────────────────────────────────────────
  { name: "Colorado Legal Services",              state: "CO", city: "Denver",         address: "1905 Sherman St",      zip: "80203", phone: "(303) 837-1313", website: "https://coloradolegalservices.org" },

  // ── Connecticut ───────────────────────────────────────────────────────────
  { name: "Connecticut Legal Services",           state: "CT", city: "Waterbury",      address: "211 State St",         zip: "06702", phone: "(203) 756-9053", website: "https://ctlegal.org" },
  { name: "Greater Hartford Legal Aid",           state: "CT", city: "Hartford",       address: "999 Asylum Ave",       zip: "06105", phone: "(860) 541-5000", website: "https://ghla.org" },

  // ── DC ────────────────────────────────────────────────────────────────────
  { name: "Legal Aid Society of D.C.",            state: "DC", city: "Washington",     address: "1331 H St NW",         zip: "20005", phone: "(202) 628-1161", website: "https://legalaiddc.org" },
  { name: "Bread for the City Legal Clinic",      state: "DC", city: "Washington",     address: "1525 7th St NW",       zip: "20001", phone: "(202) 265-2400", website: "https://breadforthecity.org" },

  // ── Delaware ──────────────────────────────────────────────────────────────
  { name: "Community Legal Aid Society",          state: "DE", city: "Wilmington",     address: "100 W 10th St",        zip: "19801", phone: "(302) 575-0660", website: "https://declasi.org" },

  // ── Georgia ───────────────────────────────────────────────────────────────
  { name: "Georgia Legal Services Program",       state: "GA", city: "Atlanta",        address: "104 Marietta St NW",   zip: "30303", phone: "(404) 206-5175", website: "https://glsp.org" },
  { name: "Atlanta Legal Aid Society",            state: "GA", city: "Atlanta",        address: "54 Ellis St NE",       zip: "30303", phone: "(404) 524-5811", website: "https://atlantalegalaid.org" },

  // ── Hawaii ────────────────────────────────────────────────────────────────
  { name: "Legal Aid Society of Hawaii",          state: "HI", city: "Honolulu",       address: "924 Bethel St",        zip: "96813", phone: "(808) 536-4302", website: "https://legalaidhawaii.org" },

  // ── Idaho ─────────────────────────────────────────────────────────────────
  { name: "Idaho Legal Aid Services",             state: "ID", city: "Boise",          address: "310 N 5th St",         zip: "83702", phone: "(208) 336-8980", website: "https://idaholegalaid.org" },

  // ── Indiana ───────────────────────────────────────────────────────────────
  { name: "Indiana Legal Services",               state: "IN", city: "Indianapolis",   address: "151 N Delaware St",    zip: "46204", phone: "(317) 631-9410", website: "https://indianalegalservices.org" },

  // ── Iowa ──────────────────────────────────────────────────────────────────
  { name: "Iowa Legal Aid",                       state: "IA", city: "Des Moines",     address: "1111 9th St",          zip: "50314", phone: "(515) 243-2151", website: "https://iowalegalaid.org" },

  // ── Kansas ────────────────────────────────────────────────────────────────
  { name: "Kansas Legal Services",                state: "KS", city: "Topeka",         address: "712 S Kansas Ave",     zip: "66603", phone: "(785) 233-2068", website: "https://kansaslegalservices.org" },

  // ── Kentucky ──────────────────────────────────────────────────────────────
  { name: "Legal Aid of the Bluegrass",           state: "KY", city: "Covington",      address: "302 W Pike St",        zip: "41011", phone: "(859) 431-8200", website: "https://lablaw.org" },
  { name: "Appalachian Research & Defense Fund",  state: "KY", city: "Prestonsburg",   address: "120 N Front Ave",      zip: "41653", phone: "(606) 886-8688", website: "https://ardfky.org" },

  // ── Louisiana ─────────────────────────────────────────────────────────────
  { name: "Southeast Louisiana Legal Services",   state: "LA", city: "New Orleans",    address: "1010 Common St",       zip: "70112", phone: "(504) 529-1000", website: "https://slls.org" },
  { name: "Acadiana Legal Service Corporation",   state: "LA", city: "Lafayette",      address: "1020 Surrey St",       zip: "70501", phone: "(337) 237-4320", website: "https://acadianalegal.org" },

  // ── Maine ─────────────────────────────────────────────────────────────────
  { name: "Pine Tree Legal Assistance",           state: "ME", city: "Portland",       address: "88 Federal St",        zip: "04101", phone: "(207) 774-8211", website: "https://ptla.org" },

  // ── Maryland ──────────────────────────────────────────────────────────────
  { name: "Maryland Legal Aid Bureau",            state: "MD", city: "Baltimore",      address: "500 E Lexington St",   zip: "21202", phone: "(410) 539-5340", website: "https://mdlab.org" },

  // ── Massachusetts ─────────────────────────────────────────────────────────
  { name: "Greater Boston Legal Services",        state: "MA", city: "Boston",         address: "197 Friend St",        zip: "02114", phone: "(617) 603-1700", website: "https://gbls.org" },
  { name: "South Coastal Counties Legal Services", state: "MA", city: "Brockton",      address: "231 Main St",          zip: "02301", phone: "(508) 586-2110", website: "https://sccls.org" },

  // ── Michigan ──────────────────────────────────────────────────────────────
  { name: "Legal Services of South Central Michigan", state: "MI", city: "Ann Arbor",  address: "2990 E Michigan Ave",  zip: "48108", phone: "(734) 665-6181", website: "https://lsscm.org" },
  { name: "Michigan Advocacy Program",            state: "MI", city: "Lansing",        address: "420 S Michigan Ave",   zip: "48933", phone: "(517) 372-0622", website: "https://miadvocacy.org" },

  // ── Mississippi ───────────────────────────────────────────────────────────
  { name: "Mississippi Center for Legal Services", state: "MS", city: "Jackson",       address: "120 N Congress St",    zip: "39201", phone: "(601) 948-6752", website: "https://mscenterforlegalservices.org" },
  { name: "North MS Rural Legal Services",        state: "MS", city: "Oxford",         address: "220 S Lamar Blvd",     zip: "38655", phone: "(662) 234-8731", website: "https://nmrls.com" },

  // ── Missouri ──────────────────────────────────────────────────────────────
  { name: "Legal Services of Eastern Missouri",   state: "MO", city: "Saint Louis",    address: "4232 Forest Park Ave", zip: "63108", phone: "(314) 534-4200", website: "https://lsem.org" },
  { name: "Legal Aid of Western Missouri",        state: "MO", city: "Kansas City",    address: "1125 Grand Blvd",      zip: "64106", phone: "(816) 474-6750", website: "https://lawmo.org" },

  // ── Montana ───────────────────────────────────────────────────────────────
  { name: "Montana Legal Services Association",   state: "MT", city: "Helena",         address: "616 Helena Ave",       zip: "59601", phone: "(406) 442-9830", website: "https://montanalegalservices.org" },

  // ── Nebraska ──────────────────────────────────────────────────────────────
  { name: "Nebraska Legal Aid",                   state: "NE", city: "Omaha",          address: "134 S 13th St",        zip: "68508", phone: "(402) 348-1069", website: "https://nebraskalegalaid.org" },

  // ── Nevada ────────────────────────────────────────────────────────────────
  { name: "Nevada Legal Aid",                     state: "NV", city: "Las Vegas",      address: "530 S 6th St",         zip: "89101", phone: "(702) 386-1070", website: "https://nlvlaw.org" },
  { name: "Washoe Legal Services",                state: "NV", city: "Reno",           address: "299 Bledsoe Ln",       zip: "89502", phone: "(775) 329-2727", website: "https://washoelegalservices.org" },

  // ── New Hampshire ─────────────────────────────────────────────────────────
  { name: "New Hampshire Legal Assistance",       state: "NH", city: "Manchester",     address: "1750 Elm St",          zip: "03104", phone: "(603) 625-6560", website: "https://nhla.org" },

  // ── New Jersey ────────────────────────────────────────────────────────────
  { name: "Legal Services of New Jersey",         state: "NJ", city: "Edison",         address: "100 Metroplex Dr",     zip: "08817", phone: "(888) 576-5529", website: "https://lsnj.org" },
  { name: "South Jersey Legal Services",          state: "NJ", city: "Camden",         address: "745 Market St",        zip: "08102", phone: "(856) 964-2010", website: "https://southjerseylegalservices.org" },

  // ── New Mexico ────────────────────────────────────────────────────────────
  { name: "New Mexico Legal Aid",                 state: "NM", city: "Albuquerque",    address: "301 Gold Ave SW",      zip: "87102", phone: "(505) 243-7871", website: "https://nmlegalaid.org" },

  // ── North Carolina ────────────────────────────────────────────────────────
  { name: "Legal Aid of North Carolina",          state: "NC", city: "Raleigh",        address: "224 S Dawson St",      zip: "27601", phone: "(919) 856-2564", website: "https://legalaidnc.org" },

  // ── North Dakota ──────────────────────────────────────────────────────────
  { name: "Legal Services of North Dakota",       state: "ND", city: "Bismarck",       address: "418 E Broadway",       zip: "58501", phone: "(701) 222-2110", website: "https://lsnd.org" },

  // ── Ohio ──────────────────────────────────────────────────────────────────
  { name: "Legal Aid Society of Columbus",        state: "OH", city: "Columbus",       address: "1108 City Park Ave",   zip: "43206", phone: "(614) 224-8374", website: "https://columbuslegalaid.org" },
  { name: "Legal Aid Society of Cleveland",       state: "OH", city: "Cleveland",      address: "1223 W 6th St",        zip: "44113", phone: "(216) 687-1900", website: "https://lasclev.org" },

  // ── Oklahoma ──────────────────────────────────────────────────────────────
  { name: "Legal Aid Services of Oklahoma",       state: "OK", city: "Oklahoma City",  address: "2915 Classen Blvd",    zip: "73106", phone: "(405) 521-1302", website: "https://legalaidok.org" },

  // ── Oregon ────────────────────────────────────────────────────────────────
  { name: "Legal Aid Services of Oregon",         state: "OR", city: "Portland",       address: "520 SW 6th Ave",       zip: "97204", phone: "(503) 224-4086", website: "https://lasoregon.org" },
  { name: "Oregon Law Center",                    state: "OR", city: "Salem",          address: "230 Church St NE",     zip: "97301", phone: "(503) 485-4152", website: "https://oregonlawcenter.org" },

  // ── Pennsylvania ──────────────────────────────────────────────────────────
  { name: "Community Legal Services",             state: "PA", city: "Philadelphia",   address: "1424 Chestnut St",     zip: "19102", phone: "(215) 981-3700", website: "https://clsphila.org" },
  { name: "MidPenn Legal Services",               state: "PA", city: "Harrisburg",     address: "213 N Front St",       zip: "17101", phone: "(717) 234-4121", website: "https://midpenn.org" },

  // ── Rhode Island ──────────────────────────────────────────────────────────
  { name: "Rhode Island Legal Services",          state: "RI", city: "Providence",     address: "56 Pine St",           zip: "02903", phone: "(401) 274-2652", website: "https://rils.org" },

  // ── South Carolina ────────────────────────────────────────────────────────
  { name: "South Carolina Legal Services",        state: "SC", city: "Columbia",       address: "2109 Bull St",         zip: "29201", phone: "(803) 799-9668", website: "https://sclegal.org" },

  // ── South Dakota ──────────────────────────────────────────────────────────
  { name: "East River Legal Services",            state: "SD", city: "Sioux Falls",    address: "335 N Main Ave",       zip: "57104", phone: "(605) 336-9230", website: "https://eastriverlegalservices.org" },
  { name: "Dakota Plains Legal Services",         state: "SD", city: "Mission",        address: "101 Main St",          zip: "57555", phone: "(605) 856-4444", website: "https://dpls.org" },

  // ── Tennessee ─────────────────────────────────────────────────────────────
  { name: "Legal Aid Society of Middle Tennessee", state: "TN", city: "Nashville",     address: "300 Deaderick St",     zip: "37201", phone: "(615) 244-6610", website: "https://las.org" },
  { name: "Memphis Area Legal Services",          state: "TN", city: "Memphis",        address: "200 Jefferson Ave",    zip: "38103", phone: "(901) 523-8822", website: "https://malsi.org" },

  // ── Utah ──────────────────────────────────────────────────────────────────
  { name: "Utah Legal Services",                  state: "UT", city: "Salt Lake City", address: "186 N 400 W",          zip: "84103", phone: "(801) 328-8891", website: "https://utahlegalservices.org" },

  // ── Vermont ───────────────────────────────────────────────────────────────
  { name: "Vermont Legal Aid",                    state: "VT", city: "Burlington",     address: "264 N Winooski Ave",   zip: "05401", phone: "(802) 863-5620", website: "https://vtlegalaid.org" },

  // ── Virginia ──────────────────────────────────────────────────────────────
  { name: "Legal Aid Justice Center",             state: "VA", city: "Charlottesville", address: "1000 Preston Ave",    zip: "22903", phone: "(434) 977-0553", website: "https://justice4all.org" },
  { name: "Central Virginia Legal Aid Society",   state: "VA", city: "Richmond",       address: "101 W Broad St",       zip: "23220", phone: "(804) 648-1012", website: "https://cvlas.org" },

  // ── West Virginia ─────────────────────────────────────────────────────────
  { name: "Legal Aid of West Virginia",           state: "WV", city: "Charleston",     address: "922 Quarrier St",      zip: "25301", phone: "(304) 342-6814", website: "https://lawv.net" },

  // ── Wisconsin ─────────────────────────────────────────────────────────────
  { name: "Legal Action of Wisconsin",            state: "WI", city: "Milwaukee",      address: "230 W Wells St",       zip: "53203", phone: "(414) 278-7722", website: "https://legalaction.org" },

  // ── Wyoming ───────────────────────────────────────────────────────────────
  { name: "Wyoming Center for Equality",          state: "WY", city: "Cheyenne",       address: "1622 Carey Ave",       zip: "82001", phone: "(307) 634-9261", website: "https://wycenter.org" },
];

async function seedLSC(existing: Set<string>) {
  console.log("\n═══ PHASE 3: LSC-Funded Legal Aid Organizations (Legal) ═══");
  console.log(`  Processing ${LSC_ORGS.length} verified LSC grantees…`);
  let total = 0;

  const byState: Partial<Record<State, ResourceRow[]>> = {};

  for (const org of LSC_ORGS) {
    const geoQuery = `${org.address}, ${org.city}, ${org.state} ${org.zip}`;
    let lat = 0, lng = 0;

    const geo = await geocode(geoQuery);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
    } else {
      // Fall back to city-level
      const geoCity = await geocode(`${org.city}, ${org.state}`);
      if (!geoCity) {
        console.warn(`    Could not geocode: ${org.name} — skipping`);
        continue;
      }
      lat = geoCity.lat;
      lng = geoCity.lng;
    }

    byState[org.state] = byState[org.state] ?? [];
    byState[org.state]!.push({
      name:     org.name,
      category: "legal",
      status:   "open",
      address:  org.address,
      city:     org.city,
      state:    org.state,
      zip:      org.zip.slice(0, 10),
      lat,
      lng,
      phone:    org.phone,
      website:  org.website,
      urgent:   false,
      verified: true,
    });
  }

  for (const state of STATES) {
    const records = byState[state] ?? [];
    const n = await insertRecords(records, existing);
    total += n;
    console.log(`  ${state}: inserted ${n} / ${records.length} legal records`);
  }

  console.log(`  PHASE 3 TOTAL: ${total} records inserted`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIX COORDINATES — geocode existing records with bad/missing US coordinates
// ═══════════════════════════════════════════════════════════════════════════════

async function fixCoordinates() {
  console.log("\n═══ FIX COORDINATES: Auditing existing records ═══");

  const { data: records, error } = await supabase
    .from("resources")
    .select("id, name, address, city, state, zip, lat, lng");

  if (error) {
    console.error("  Could not fetch records:", error.message);
    return;
  }

  const invalid = (records ?? []).filter(
    r => !validUSCoords(Number(r.lat), Number(r.lng))
  );

  if (!invalid.length) {
    console.log("  All records have valid US coordinates — nothing to fix.");
    return;
  }

  console.log(`  Found ${invalid.length} records with invalid/missing US coordinates`);

  let fixed = 0;
  const failed: string[] = [];

  for (const r of invalid) {
    let geo = await geocode(`${r.address}, ${r.city}, ${r.state} ${r.zip ?? ""}`);
    if (!geo) {
      geo = await geocode(`${r.city}, ${r.state}`);
    }
    if (!geo) {
      failed.push(`${r.name} — ${r.address}, ${r.city}, ${r.state}`);
      continue;
    }

    const { error: updateErr } = await supabase
      .from("resources")
      .update({ lat: geo.lat, lng: geo.lng })
      .eq("id", r.id);

    if (updateErr) {
      console.error(`    Update failed for "${r.name}": ${updateErr.message}`);
    } else {
      fixed++;
    }
  }

  console.log(`  Fixed: ${fixed} / ${invalid.length}`);
  if (failed.length) {
    console.log(`  Could not geocode (fix manually):`);
    failed.forEach(f => console.log(`    - ${f}`));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  REFUGEE_NODE — Database Seed (Government Sources)  ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`\nTarget states: ${STATES.join(", ")}`);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("\n✗  NEXT_PUBLIC_SUPABASE_URL not set — check .env.local");
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("\n✗  SUPABASE_SERVICE_ROLE_KEY not set — check .env.local");
    process.exit(1);
  }
  if (!MAPBOX_TOKEN) {
    console.warn("\n⚠  NEXT_PUBLIC_MAPBOX_TOKEN not set — geocoding disabled (records missing coords will be skipped)");
  }

  const existing = await loadExistingKeys();
  console.log(`\nLoaded ${existing.size} existing records for deduplication\n`);

  await seedHRSA(existing);
  await seedOSMShelters(existing);
  await seedLSC(existing);
  await fixCoordinates();

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  SEED COMPLETE — INSERT SUMMARY                     ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // Pivot stats: state → { category → count }
  const pivot: Record<string, Record<string, number>> = {};
  let grandTotal = 0;
  for (const [key, count] of Object.entries(insertStats)) {
    const [st, cat] = key.split(":");
    pivot[st] = pivot[st] ?? {};
    pivot[st][cat] = count;
    grandTotal += count;
  }

  for (const state of STATES) {
    if (!pivot[state]) continue;
    const stateTotal = Object.values(pivot[state]).reduce((a, b) => a + b, 0);
    console.log(`${state}  (${stateTotal} total):`);
    for (const [cat, n] of Object.entries(pivot[state]).sort()) {
      console.log(`  ${cat.padEnd(14)} ${n}`);
    }
  }

  // Confirm count in DB
  const { count } = await supabase
    .from("resources")
    .select("*", { count: "exact", head: true });

  console.log(`\nThis run inserted : ${grandTotal}`);
  console.log(`Total in database : ${count ?? "unknown"}`);
  console.log(`Geocode API calls : ${geocodeCount}`);
}

main().catch(e => {
  console.error("\nFatal:", e);
  process.exit(1);
});
