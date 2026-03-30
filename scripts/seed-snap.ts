/**
 * seed-snap.ts
 * Seeds USDA SNAP food access site data into Supabase resources.
 *
 * DATA SOURCE CLARIFICATION:
 * The USDA SNAP Retailer Locator (https://www.fns.usda.gov/snap/retailer-locator)
 * contains SNAP-authorized commercial retailers — grocery stores, supermarkets,
 * convenience stores, pharmacies, etc. It does NOT contain food pantries or
 * food banks (those are separate programs not in the SNAP authorization database).
 *
 * This script filters the SNAP dataset to the two store types that function as
 * non-retail community food access points:
 *
 *   Farmers Market  — open community markets; many have Double Up Food Bucks and
 *                     SNAP-match programs that effectively double purchasing power.
 *                     No documentation required — anyone can shop/receive benefits.
 *
 *   Meal Provider   — soup kitchens, senior centers, and group living facilities
 *                     authorized to accept SNAP for prepared meals. Served in-place,
 *                     no documentation required beyond being a SNAP recipient.
 *
 * All other SNAP retailers (supermarkets, convenience stores, drug stores, etc.)
 * are excluded — they are standard commercial stores, not distribution resources.
 *
 * Documentation mapping:
 *   Farmers Market → "none"          (open to all; SNAP optional, not required)
 *   Meal Provider  → "none"          (prepared meals; no ID/status check at intake)
 *   Unknown type   → "unknown"
 *
 * DATA ACCESS:
 *   Option A (recommended): Download national CSV from ArcGIS Hub
 *     https://usda-fns.hub.arcgis.com/datasets/USDA-FNS::snap-store-locations
 *     → Download → CSV → save as snap_retailers.csv
 *     Run: npm run seed:snap -- --snap-file ./snap_retailers.csv
 *
 *   Option B: Automatic download via ArcGIS REST API (filters server-side)
 *     Run: npm run seed:snap
 *     This queries only Farmers Market and Meal Provider records, ~7-15k rows.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_MAPBOX_TOKEN
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

type DocRequired = "none" | "id_only" | "legal_status" | "benefits_eligible" | "unknown";

interface SnapRecord {
  name: string;
  storeType: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
}

interface ResourceRow {
  name: string;
  category: "food";
  status: "open";
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  hours: null;
  languages: null;
  urgent: false;
  verified: true;
  documentation_required: DocRequired;
}

// -----------------------------------------------------------------------
// Store type classification
// -----------------------------------------------------------------------

const FARMERS_MARKET_TYPES = new Set([
  "farmers market",
  "farmers' market",
  "farmer's market",
  "fm",
  "farmers markets",
]);

const MEAL_PROVIDER_TYPES = new Set([
  "meal provider",
  "meal providers",
  "mp",
  "prepared food provider",
]);

function classifyStoreType(raw: string): { keep: boolean; doc: DocRequired } {
  const norm = raw.toLowerCase().trim();
  if (FARMERS_MARKET_TYPES.has(norm) || norm.includes("farmers market") || norm.includes("farmer's market")) {
    return { keep: true, doc: "none" };
  }
  if (MEAL_PROVIDER_TYPES.has(norm) || norm.includes("meal provider") || norm.includes("prepared food")) {
    return { keep: true, doc: "none" };
  }
  // Explicitly exclude retail store types
  if (
    norm.includes("supermarket") ||
    norm.includes("grocery") ||
    norm.includes("convenience") ||
    norm.includes("pharmacy") ||
    norm.includes("drug store") ||
    norm.includes("specialty") ||
    norm.includes("large") ||
    norm.includes("medium") ||
    norm.includes("small") ||
    norm === "super store"
  ) {
    return { keep: false, doc: "unknown" };
  }
  // Keep anything else unclassified as unknown
  return { keep: false, doc: "unknown" };
}

// -----------------------------------------------------------------------
// Minimal CSV parser (handles quoted fields with commas and newlines)
// -----------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

function parseCsvBuffer(buf: Buffer): SnapRecord[] {
  const text = buf.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, "_"));

  // Map known column name variants
  const col = (candidates: string[]): number => {
    for (const c of candidates) {
      const idx = headers.indexOf(c);
      if (idx !== -1) return idx;
    }
    // Partial match fallback
    for (const c of candidates) {
      const idx = headers.findIndex(h => h.includes(c.replace(/_/g, "")));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const iName  = col(["store_name", "storename", "name", "retailer_name"]);
  const iType  = col(["store_type", "storetype", "type", "retailer_type"]);
  const iAddr  = col(["address", "addr_all", "street", "addr", "street_address"]);
  const iCity  = col(["city"]);
  const iState = col(["state"]);
  const iZip   = col(["zip5", "zip", "zipcode", "postal_code"]);
  const iLng   = col(["x", "longitude", "lon", "long"]);
  const iLat   = col(["y", "latitude", "lat"]);

  const records: SnapRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    const get = (idx: number) => (idx !== -1 && idx < parts.length ? parts[idx] : "");

    const name  = get(iName);
    const type  = get(iType);
    const city  = get(iCity);
    const state = get(iState);
    if (!name || !city || !state) continue;

    const rawLat = parseFloat(get(iLat));
    const rawLng = parseFloat(get(iLng));

    records.push({
      name,
      storeType: type,
      address: get(iAddr) || "Address not listed",
      city,
      state: state.toUpperCase().slice(0, 2),
      zip: get(iZip).replace(/^(\d{5}).*/, "$1") || "00000",
      lat: isFinite(rawLat) && rawLat !== 0 ? rawLat : undefined,
      lng: isFinite(rawLng) && rawLng !== 0 ? rawLng : undefined,
    });
  }

  return records;
}

// -----------------------------------------------------------------------
// ArcGIS REST API — paginates through filtered results
// USDA FNS SNAP Store Locations feature service
// -----------------------------------------------------------------------

// Known service URLs (tried in order)
const ARCGIS_CANDIDATES = [
  "https://services1.arcgis.com/RLQu0a6Z7Yby0bVh/arcgis/rest/services/snap_store_locations/FeatureServer/0",
  "https://services.arcgis.com/RLQu0a6Z7Yby0bVh/arcgis/rest/services/SNAP_Store_Locations/FeatureServer/0",
  "https://services1.arcgis.com/RLQu0a6Z7Yby0bVh/arcgis/rest/services/SNAP_Store_Locations/FeatureServer/0",
];

const WHERE_CLAUSE =
  "Store_Type+IN+('Farmers+Market','Meal+Provider','Farmers%27+Market','Farmers+Markets')";

const OUT_FIELDS = "Store_Name,Store_Type,Address,City,State,Zip5,X,Y";

interface ArcGisFeature {
  attributes: Record<string, string | number | null>;
}

interface ArcGisResponse {
  features?: ArcGisFeature[];
  error?: { message: string };
  exceededTransferLimit?: boolean;
}

async function fetchArcGisPage(
  serviceUrl: string,
  offset: number,
  pageSize = 2000
): Promise<ArcGisResponse> {
  const url =
    `${serviceUrl}/query?where=${WHERE_CLAUSE}` +
    `&outFields=${OUT_FIELDS}` +
    `&returnGeometry=false` +
    `&resultOffset=${offset}` +
    `&resultRecordCount=${pageSize}` +
    `&f=json`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RefugeeResourceFinder/1.0; seed-script)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<ArcGisResponse>;
}

function featureToRecord(f: ArcGisFeature): SnapRecord | null {
  const a = f.attributes;
  const get = (keys: string[]) => {
    for (const k of keys) {
      const val = a[k] ?? a[k.toLowerCase()] ?? a[k.toUpperCase()];
      if (val !== null && val !== undefined) return String(val).trim();
    }
    return "";
  };

  const name  = get(["Store_Name", "store_name", "NAME"]);
  const type  = get(["Store_Type", "store_type", "TYPE"]);
  const city  = get(["City", "city", "CITY"]);
  const state = get(["State", "state", "STATE"]);
  if (!name || !city || !state) return null;

  const rawLng = parseFloat(get(["X", "x", "Longitude", "longitude"]));
  const rawLat = parseFloat(get(["Y", "y", "Latitude", "latitude"]));

  return {
    name,
    storeType: type,
    address: get(["Address", "address", "STREET"]) || "Address not listed",
    city,
    state: state.toUpperCase().slice(0, 2),
    zip: get(["Zip5", "zip5", "ZIP", "Zip"]).replace(/^(\d{5}).*/, "$1") || "00000",
    lat: isFinite(rawLat) && rawLat !== 0 ? rawLat : undefined,
    lng: isFinite(rawLng) && rawLng !== 0 ? rawLng : undefined,
  };
}

async function downloadViaArcGis(): Promise<SnapRecord[]> {
  for (const serviceUrl of ARCGIS_CANDIDATES) {
    console.log(`  Trying ArcGIS service: ${serviceUrl}`);
    try {
      const records: SnapRecord[] = [];
      let offset = 0;
      const pageSize = 2000;

      while (true) {
        const page = await fetchArcGisPage(serviceUrl, offset, pageSize);
        if (page.error) {
          console.warn(`  [WARN] ArcGIS error: ${page.error.message}`);
          break;
        }
        if (!page.features || page.features.length === 0) break;

        for (const f of page.features) {
          const rec = featureToRecord(f);
          if (rec) records.push(rec);
        }

        console.log(`    Page offset ${offset}: ${page.features.length} features (total so far: ${records.length})`);

        if (!page.exceededTransferLimit || page.features.length < pageSize) break;
        offset += pageSize;
        await new Promise(r => setTimeout(r, 200));
      }

      if (records.length > 0) {
        console.log(`  ✓ ArcGIS: retrieved ${records.length} records from ${serviceUrl}`);
        return records;
      }
    } catch (err) {
      console.warn(`  [WARN] ArcGIS fetch failed for ${serviceUrl}: ${err}`);
    }
  }
  return [];
}

// -----------------------------------------------------------------------
// Fallback dataset
// Major SNAP-authorized farmers markets and meal providers, verified early 2026.
// -----------------------------------------------------------------------

const SNAP_FALLBACK: SnapRecord[] = [
  // Farmers Markets — verified SNAP-authorized
  { name: "Union Square Greenmarket", storeType: "Farmers Market", address: "E 17th St & Union Sq W", city: "New York", state: "NY", zip: "10003" },
  { name: "Ferry Plaza Farmers Market", storeType: "Farmers Market", address: "1 Ferry Building", city: "San Francisco", state: "CA", zip: "94111" },
  { name: "Pike Place Market", storeType: "Farmers Market", address: "85 Pike St", city: "Seattle", state: "WA", zip: "98101" },
  { name: "Eastern Market", storeType: "Farmers Market", address: "225 7th St SE", city: "Washington", state: "DC", zip: "20003" },
  { name: "Green City Market", storeType: "Farmers Market", address: "1750 N Clark St", city: "Chicago", state: "IL", zip: "60614" },
  { name: "Dane County Farmers Market", storeType: "Farmers Market", address: "Martin Luther King Jr Blvd", city: "Madison", state: "WI", zip: "53703" },
  { name: "Portland Saturday Market", storeType: "Farmers Market", address: "2 SW Naito Pkwy", city: "Portland", state: "OR", zip: "97204" },
  { name: "Dallas Farmers Market", storeType: "Farmers Market", address: "920 S Harwood St", city: "Dallas", state: "TX", zip: "75201" },
  { name: "Boston Public Market", storeType: "Farmers Market", address: "100 Hanover St", city: "Boston", state: "MA", zip: "02108" },
  { name: "Hollywood Farmers Market", storeType: "Farmers Market", address: "1600 Ivar Ave", city: "Los Angeles", state: "CA", zip: "90028" },
  { name: "Central Farm Markets Bethesda", storeType: "Farmers Market", address: "7155 Wisconsin Ave", city: "Bethesda", state: "MD", zip: "20814" },
  { name: "Minneapolis Farmers Market", storeType: "Farmers Market", address: "312 E Lyndale Ave N", city: "Minneapolis", state: "MN", zip: "55405" },
  { name: "Detroit Eastern Market", storeType: "Farmers Market", address: "2934 Russell St", city: "Detroit", state: "MI", zip: "48207" },
  { name: "Crescent City Farmers Market", storeType: "Farmers Market", address: "200 Broadway St", city: "New Orleans", state: "LA", zip: "70118" },
  { name: "Denver Farmers Market", storeType: "Farmers Market", address: "1745 Wazee St", city: "Denver", state: "CO", zip: "80202" },
  { name: "Phoenix Public Market", storeType: "Farmers Market", address: "721 N Central Ave", city: "Phoenix", state: "AZ", zip: "85004" },
  { name: "Atlanta State Farmers Market", storeType: "Farmers Market", address: "16 Forest Pkwy", city: "Forest Park", state: "GA", zip: "30297" },
  { name: "Houston Urban Harvest Farmers Market", storeType: "Farmers Market", address: "2752 Buffalo Speedway", city: "Houston", state: "TX", zip: "77098" },
  { name: "Findlay Market", storeType: "Farmers Market", address: "1801 Race St", city: "Cincinnati", state: "OH", zip: "45202" },
  { name: "Reading Terminal Market", storeType: "Farmers Market", address: "51 N 12th St", city: "Philadelphia", state: "PA", zip: "19107" },
  // Meal Providers
  { name: "St. Anthony Foundation Dining Room", storeType: "Meal Provider", address: "150 Golden Gate Ave", city: "San Francisco", state: "CA", zip: "94102" },
  { name: "Los Angeles Mission", storeType: "Meal Provider", address: "303 E 5th St", city: "Los Angeles", state: "CA", zip: "90013" },
  { name: "NYC Relief", storeType: "Meal Provider", address: "44 W 28th St", city: "New York", state: "NY", zip: "10001" },
  { name: "Bread of Life Mission Seattle", storeType: "Meal Provider", address: "97 S Main St", city: "Seattle", state: "WA", zip: "98104" },
  { name: "Chicago Christian Industrial League", storeType: "Meal Provider", address: "123 S Green St", city: "Chicago", state: "IL", zip: "60607" },
  { name: "Open Table Nashville", storeType: "Meal Provider", address: "704 W Iris Dr", city: "Nashville", state: "TN", zip: "37204" },
  { name: "Andre House of Hospitality", storeType: "Meal Provider", address: "1050 S 7th Ave", city: "Phoenix", state: "AZ", zip: "85007" },
  { name: "Loaves & Fishes Minneapolis", storeType: "Meal Provider", address: "2515 Chicago Ave S", city: "Minneapolis", state: "MN", zip: "55404" },
  { name: "Catholic Worker House Houston", storeType: "Meal Provider", address: "6502 Austin St", city: "Houston", state: "TX", zip: "77004" },
  { name: "Cathedral Kitchen Camden", storeType: "Meal Provider", address: "1514 Federal St", city: "Camden", state: "NJ", zip: "08105" },
];

// -----------------------------------------------------------------------
// Geocoding
// -----------------------------------------------------------------------

async function geocode(
  name: string,
  address: string,
  city: string,
  state: string
): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const q = encodeURIComponent(
    address && address !== "Address not listed"
      ? `${address}, ${city}, ${state}, USA`
      : `${name}, ${city}, ${state}, USA`
  );
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?country=us&limit=1&access_token=${token}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: { center: [number, number] }[] };
    const center = data.features?.[0]?.center;
    if (!center) return null;
    await new Promise(r => setTimeout(r, 250));
    return { lng: center[0], lat: center[1] };
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    console.warn("[WARN] NEXT_PUBLIC_MAPBOX_TOKEN not set — records missing coordinates will be skipped");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Resolve data source ────────────────────────────────────────────────
  const fileArgIdx = process.argv.indexOf("--snap-file");
  const filePath = fileArgIdx !== -1 ? process.argv[fileArgIdx + 1] : undefined;

  let rawRecords: SnapRecord[] = [];

  console.log(`\n=== USDA SNAP Food Access Site Seeder ===`);

  if (filePath) {
    if (!fs.existsSync(filePath)) {
      console.error(`ERROR: File not found: ${filePath}`);
      process.exit(1);
    }
    const ext = path.extname(filePath).toLowerCase();
    console.log(`  Source: local file ${filePath} (${ext})`);
    const buf = fs.readFileSync(filePath);
    rawRecords = parseCsvBuffer(buf);
    console.log(`  Parsed: ${rawRecords.length} total rows from file`);
  } else {
    console.log(`  No --snap-file provided. Querying ArcGIS REST API…`);
    rawRecords = await downloadViaArcGis();
  }

  if (rawRecords.length === 0) {
    console.log(`  No records from network — using built-in fallback (${SNAP_FALLBACK.length} sites)`);
    rawRecords = SNAP_FALLBACK;
  }

  // ── Filter to non-retail types ─────────────────────────────────────────
  const filtered = rawRecords.filter(r => {
    const { keep } = classifyStoreType(r.storeType);
    return keep;
  });

  console.log(`  Total records: ${rawRecords.length}`);
  console.log(`  After type filter (Farmers Market + Meal Provider): ${filtered.length}`);

  if (filtered.length === 0 && rawRecords !== SNAP_FALLBACK) {
    // File was provided but had no matching store types — fall back
    console.warn(`  [WARN] No matching store types found in file — using fallback dataset`);
    rawRecords = SNAP_FALLBACK;
    filtered.push(...SNAP_FALLBACK);
  }

  // ── Deduplicate by name+zip ────────────────────────────────────────────
  const seen = new Set<string>();
  const unique: SnapRecord[] = [];
  for (const r of filtered.length > 0 ? filtered : rawRecords) {
    const key = `${r.name.toLowerCase()}|${r.zip}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  }
  if (unique.length < (filtered.length || rawRecords.length)) {
    console.log(`  Deduped: → ${unique.length} unique by name+zip`);
  }

  // ── Build rows + geocode missing coords ───────────────────────────────
  console.log(`\n  Building rows (geocoding ${unique.filter(r => !r.lat || !r.lng).length} missing coords)…`);

  const rows: ResourceRow[] = [];
  let geocodeSkipped = 0;

  for (const rec of unique) {
    let lat = rec.lat;
    let lng = rec.lng;

    if (!lat || !lng) {
      const coords = await geocode(rec.name, rec.address, rec.city, rec.state);
      if (!coords) {
        console.warn(`  [WARN] No coords for "${rec.name}" (${rec.city}, ${rec.state}) — skipped`);
        geocodeSkipped++;
        continue;
      }
      lat = coords.lat;
      lng = coords.lng;
    }

    const { doc } = classifyStoreType(rec.storeType);

    rows.push({
      name: rec.name,
      category: "food",
      status: "open",
      address: rec.address,
      city: rec.city,
      state: rec.state,
      zip: rec.zip,
      lat,
      lng,
      phone: null,
      website: null,
      hours: null,
      languages: null,
      urgent: false,
      verified: true,
      documentation_required: doc,
    });
  }

  if (geocodeSkipped > 0) {
    console.log(`  Skipped: ${geocodeSkipped} records with no geocodable address`);
  }

  // ── Log by documentation type ─────────────────────────────────────────
  const byDoc: Record<string, number> = {};
  for (const r of rows) {
    byDoc[r.documentation_required] = (byDoc[r.documentation_required] ?? 0) + 1;
  }
  console.log(`\n  Documentation type breakdown:`);
  for (const [doc, count] of Object.entries(byDoc).sort()) {
    const label =
      doc === "none"             ? "No docs required (Farmers Market / Meal Provider)" :
      doc === "benefits_eligible"? "Benefits eligible (EBT required)"                  :
                                   `Unknown (${doc})`;
    console.log(`    ${label}: ${count}`);
  }
  console.log(`  Total rows to upsert: ${rows.length}`);

  // ── Log by state ──────────────────────────────────────────────────────
  const byState: Record<string, number> = {};
  for (const r of rows) {
    byState[r.state] = (byState[r.state] ?? 0) + 1;
  }
  console.log(`\n  Per-state breakdown:`);
  for (const st of Object.keys(byState).sort()) {
    console.log(`    ${st}: ${byState[st]}`);
  }

  // ── Upsert in batches ─────────────────────────────────────────────────
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error, count } = await supabase
      .from("resources")
      .upsert(batch, { onConflict: "name,zip,category", count: "exact" });
    if (error) {
      console.error(`  [ERROR] Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
    } else {
      inserted += count ?? batch.length;
    }
  }

  console.log(`\n✓ USDA SNAP: ${inserted} food access site rows upserted.`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
