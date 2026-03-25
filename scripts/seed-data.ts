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

const STATES = ["NY", "CA", "TX", "IL", "FL", "WA", "AZ", "MN"] as const;
type State = typeof STATES[number];

// State full names for Overpass queries
const STATE_NAMES: Record<State, string> = {
  NY: "New York",
  CA: "California",
  TX: "Texas",
  IL: "Illinois",
  FL: "Florida",
  WA: "Washington",
  AZ: "Arizona",
  MN: "Minnesota",
};

// Approximate bounding boxes [south, west, north, east] for Overpass
const STATE_BBOX: Record<State, [number, number, number, number]> = {
  NY: [40.4,  -79.8, 45.1, -71.8],
  CA: [32.5, -124.5, 42.0, -114.1],
  TX: [25.8, -106.7, 36.5,  -93.5],
  IL: [36.9,  -91.5, 42.5,  -87.0],
  FL: [24.4,  -87.6, 31.0,  -80.0],
  WA: [45.5, -124.8, 49.0, -116.9],
  AZ: [31.3, -114.8, 37.0, -109.0],
  MN: [43.5,  -97.2, 49.4,  -89.5],
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
      "geocoding artifact address primary y coordinate"
    );
    const lngRaw = csvGet(
      row, headers,
      "geocoding artifact address primary x coordinate"
    );

    if (!name || !address || !city) continue;

    let lat = Number(latRaw);
    let lng = Number(lngRaw);

    if (!validCoords(lat, lng)) {
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
  { name: "Southern Minnesota Regional Legal Svcs", state: "MN", city: "Saint Paul",  address: "700 Minnesota Building, 46 E 4th St", zip: "55101", phone: "(651) 222-7925", website: "https://www.smrls.org" },
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
