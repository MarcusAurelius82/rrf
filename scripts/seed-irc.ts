#!/usr/bin/env tsx
/**
 * scripts/seed-irc.ts
 *
 * Seeds Supabase with IRC (International Rescue Committee) US office locations.
 * Each office is inserted as 5 records — one per category:
 *   shelter  → urgent: true
 *   medical  → urgent: true
 *   food     → urgent: false
 *   legal    → urgent: false
 *   language → urgent: false
 *
 * All records: verified: true, status: "open"
 *
 * Run:  npx tsx scripts/seed-irc.ts
 *
 * Requires .env.local:
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

interface ResourceRow {
  name:      string;
  category:  Category;
  status:    "open";
  address:   string;
  city:      string;
  state:     string;
  zip:       string;
  lat:       number;
  lng:       number;
  phone?:    string;
  website?:  string;
  languages?: string[];
  urgent:    boolean;
  verified:  boolean;
}

// ── Supabase + Mapbox clients ─────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// ── Geocoding ─────────────────────────────────────────────────────────────────

let geocodeCount = 0;
async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN) return null;
  if (geocodeCount > 0 && geocodeCount % 10 === 0) {
    await new Promise(r => setTimeout(r, 500));
  }
  geocodeCount++;
  const enc = encodeURIComponent(query);
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${enc}.json` +
    `?access_token=${MAPBOX_TOKEN}&limit=1&country=US&types=address,poi`;
  try {
    const res  = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json() as { features?: Array<{ center: [number, number]; context?: Array<{ id: string; text: string }> }> };
    if (!json.features?.length) return null;
    const [lng, lat] = json.features[0].center;
    return { lat, lng };
  } catch { return null; }
}

// ── IRC US office data ────────────────────────────────────────────────────────
// Source: rescue.org/where-we-work (scraped 2026-03)
// Languages are those spoken by IRC staff at each office per rescue.org office pages.

interface IrcOffice {
  city:      string;
  state:     string;
  address:   string;
  zip:       string;
  phone?:    string;
  website:   string;
  languages: string[];
  lat?:      number;
  lng?:      number;
}

const IRC_OFFICES: IrcOffice[] = [
  {
    city: "Atlanta", state: "GA",
    address: "2305 Parklake Drive NE, Suite 100", zip: "30345",
    phone: "(678) 636-0073",
    website: "https://www.rescue.org/united-states/atlanta-ga",
    languages: ["English", "Amharic", "Arabic", "Burmese", "French", "Somali", "Spanish", "Swahili"],
  },
  {
    city: "Baltimore", state: "MD",
    address: "2510 St. Paul Street", zip: "21218",
    phone: "(410) 327-1077",
    website: "https://www.rescue.org/united-states/baltimore-md",
    languages: ["English", "Amharic", "Arabic", "French", "Kinyarwanda", "Somali", "Spanish", "Tigrinya"],
  },
  {
    city: "Boise", state: "ID",
    address: "1626 W State Street, Suite 100", zip: "83702",
    phone: "(208) 344-2030",
    website: "https://www.rescue.org/united-states/boise-id",
    languages: ["English", "Arabic", "Bosnian", "Dari", "Nepali", "Somali", "Spanish", "Swahili"],
  },
  {
    city: "Boston", state: "MA",
    address: "105 Chauncy Street, Suite 702", zip: "02111",
    phone: "(617) 742-3482",
    website: "https://www.rescue.org/united-states/boston-ma",
    languages: ["English", "Amharic", "Arabic", "French", "Haitian Creole", "Somali", "Spanish", "Tigrinya"],
  },
  {
    city: "Charlotte", state: "NC",
    address: "4801 E. Independence Blvd., Suite 1110", zip: "28212",
    phone: "(704) 536-1949",
    website: "https://www.rescue.org/united-states/charlotte-nc",
    languages: ["English", "Arabic", "French", "Kinyarwanda", "Somali", "Spanish", "Swahili"],
  },
  {
    city: "Chicago", state: "IL",
    address: "1 N. Dearborn Street, Suite 1010", zip: "60602",
    phone: "(312) 660-1444",
    website: "https://www.rescue.org/united-states/chicago-il",
    languages: ["English", "Arabic", "Burmese", "Dari", "Pashto", "Somali", "Spanish", "Ukrainian"],
  },
  {
    city: "Dallas", state: "TX",
    address: "6500 Greenville Avenue, Suite 200", zip: "75206",
    phone: "(214) 821-3535",
    website: "https://www.rescue.org/united-states/dallas-tx",
    languages: ["English", "Amharic", "Arabic", "Burmese", "Karen", "Somali", "Spanish", "Swahili"],
  },
  {
    city: "Denver", state: "CO",
    address: "3045 S. Federal Blvd.", zip: "80236",
    phone: "(720) 328-6655",
    website: "https://www.rescue.org/united-states/denver-co",
    languages: ["English", "Amharic", "Arabic", "Dari", "Nepali", "Pashto", "Somali", "Spanish"],
  },
  {
    city: "Detroit", state: "MI",
    address: "26899 Northwestern Hwy., Suite 200", zip: "48033",
    phone: "(248) 358-0020",
    website: "https://www.rescue.org/united-states/detroit-mi",
    languages: ["English", "Arabic", "Chaldean", "Kinyarwanda", "Kurdish", "Somali", "Spanish", "Swahili"],
  },
  {
    city: "Elizabeth", state: "NJ",
    address: "11 Commerce Drive, Suite 2S", zip: "07201",
    phone: "(908) 289-0720",
    website: "https://www.rescue.org/united-states/elizabeth-nj",
    languages: ["English", "Arabic", "Haitian Creole", "Portuguese", "Spanish", "Ukrainian"],
  },
  {
    city: "Houston", state: "TX",
    address: "6800 Gulfton Street, Suite 400", zip: "77081",
    phone: "(713) 660-1990",
    website: "https://www.rescue.org/united-states/houston-tx",
    languages: ["English", "Arabic", "Burmese", "Dari", "Karen", "Spanish", "Swahili", "Vietnamese"],
  },
  {
    city: "Los Angeles", state: "CA",
    address: "1111 S. Figueroa Street, Suite 2000", zip: "90015",
    phone: "(213) 386-2888",
    website: "https://www.rescue.org/united-states/los-angeles-ca",
    languages: ["English", "Arabic", "Dari", "Farsi", "Korean", "Spanish", "Tagalog", "Vietnamese"],
  },
  {
    city: "Louisville", state: "KY",
    address: "1900 Arthur Street", zip: "40208",
    phone: "(502) 479-9484",
    website: "https://www.rescue.org/united-states/louisville-ky",
    languages: ["English", "Arabic", "Burmese", "Karen", "Nepali", "Somali", "Spanish", "Swahili"],
  },
  {
    city: "Miami", state: "FL",
    address: "3250 Mary Street, Suite 400", zip: "33133",
    phone: "(786) 500-7936",
    website: "https://www.rescue.org/united-states/miami-fl",
    languages: ["English", "Creole", "French", "Portuguese", "Spanish"],
  },
  {
    city: "Minneapolis", state: "MN",
    address: "2833 Johnson Street NE", zip: "55418",
    phone: "(612) 647-0600",
    website: "https://www.rescue.org/united-states/minneapolis-mn",
    languages: ["English", "Amharic", "Arabic", "Oromo", "Somali", "Spanish", "Swahili", "Tigrinya"],
  },
  {
    city: "New York", state: "NY",
    address: "122 East 42nd Street", zip: "10168",
    phone: "(212) 551-3000",
    website: "https://www.rescue.org/united-states/new-york-ny",
    languages: ["English", "Arabic", "Bengali", "French", "Haitian Creole", "Spanish", "Tigrinya", "Ukrainian"],
  },
  {
    city: "Oakland", state: "CA",
    address: "1212 Broadway, Suite 200", zip: "94612",
    phone: "(510) 452-8222",
    website: "https://www.rescue.org/united-states/oakland-ca",
    languages: ["English", "Arabic", "Dari", "Mam", "Q'anjob'al", "Spanish", "Tigrinya", "Vietnamese"],
  },
  {
    city: "Phoenix", state: "AZ",
    address: "4425 W. Olive Avenue, Suite 400", zip: "85302",
    phone: "(602) 433-2440",
    website: "https://www.rescue.org/united-states/phoenix-az",
    languages: ["English", "Arabic", "Burmese", "Dari", "Karen", "Pashto", "Spanish", "Swahili"],
  },
  {
    city: "Pittsburgh", state: "PA",
    address: "810 River Avenue, Suite 201", zip: "15212",
    phone: "(412) 224-1400",
    website: "https://www.rescue.org/united-states/pittsburgh-pa",
    languages: ["English", "Arabic", "Burmese", "French", "Karen", "Nepali", "Somali", "Ukrainian"],
  },
  {
    city: "Portland", state: "OR",
    address: "1020 SW Taylor Street, Suite 850", zip: "97205",
    phone: "(503) 455-2890",
    website: "https://www.rescue.org/united-states/portland-or",
    languages: ["English", "Arabic", "Burmese", "Karen", "Russian", "Somali", "Spanish", "Ukrainian"],
  },
  {
    city: "Richmond", state: "VA",
    address: "2305 E. Broad Street", zip: "23223",
    phone: "(804) 592-5600",
    website: "https://www.rescue.org/united-states/richmond-va",
    languages: ["English", "Arabic", "Dari", "French", "Kinyarwanda", "Pashto", "Somali", "Spanish"],
  },
  {
    city: "Sacramento", state: "CA",
    address: "1351 Response Road, Suite A", zip: "95815",
    phone: "(916) 433-2020",
    website: "https://www.rescue.org/united-states/sacramento-ca",
    languages: ["English", "Arabic", "Dari", "Farsi", "Mam", "Russian", "Spanish", "Ukrainian"],
  },
  {
    city: "Salt Lake City", state: "UT",
    address: "231 E. 400 South, Suite 120", zip: "84111",
    phone: "(801) 328-1091",
    website: "https://www.rescue.org/united-states/salt-lake-city-ut",
    languages: ["English", "Arabic", "Burmese", "Dari", "Karen", "Nepali", "Somali", "Spanish"],
  },
  {
    city: "San Diego", state: "CA",
    address: "5348 University Avenue, Suite 205", zip: "92105",
    phone: "(619) 641-7510",
    website: "https://www.rescue.org/united-states/san-diego-ca",
    languages: ["English", "Arabic", "Dari", "Farsi", "Russian", "Somali", "Spanish", "Swahili"],
  },
  {
    city: "San Jose", state: "CA",
    address: "1975 Hamilton Avenue, Suite 10", zip: "95125",
    phone: "(408) 277-0255",
    website: "https://www.rescue.org/united-states/san-jose-ca",
    languages: ["English", "Arabic", "Dari", "Farsi", "Spanish", "Tagalog", "Ukrainian", "Vietnamese"],
  },
  {
    city: "Seattle", state: "WA",
    address: "1200 S. 336th Street", zip: "98003",
    phone: "(253) 952-3610",
    website: "https://www.rescue.org/united-states/seattle-wa",
    languages: ["English", "Amharic", "Arabic", "Burmese", "Karen", "Somali", "Spanish", "Ukrainian"],
  },
  {
    city: "Silver Spring", state: "MD",
    address: "8605 Cameron Street, Suite 400", zip: "20910",
    phone: "(301) 562-8633",
    website: "https://www.rescue.org/united-states/silver-spring-md",
    languages: ["English", "Amharic", "Arabic", "French", "Spanish", "Tigrinya"],
  },
  {
    city: "Spokane", state: "WA",
    address: "3128 E. Sprague Avenue", zip: "99202",
    phone: "(509) 343-6099",
    website: "https://www.rescue.org/united-states/spokane-wa",
    languages: ["English", "Arabic", "Dari", "Kinyarwanda", "Russian", "Somali", "Spanish", "Ukrainian"],
  },
  {
    city: "Sterling", state: "VA",
    address: "21430 Cedar Drive, Suite 234", zip: "20164",
    phone: "(571) 730-1820",
    website: "https://www.rescue.org/united-states/northern-virginia",
    languages: ["English", "Amharic", "Arabic", "Dari", "Farsi", "Pashto", "Spanish", "Tigrinya"],
  },
  {
    city: "Tucson", state: "AZ",
    address: "2530 N. Dodge Blvd.", zip: "85716",
    phone: "(520) 319-2478",
    website: "https://www.rescue.org/united-states/tucson-az",
    languages: ["English", "Arabic", "Dari", "Pashto", "Somali", "Spanish", "Swahili"],
  },
  {
    city: "Turlock", state: "CA",
    address: "255 N. Broadway, Suite A", zip: "95380",
    phone: "(209) 250-7220",
    website: "https://www.rescue.org/united-states/turlock-ca",
    languages: ["English", "Arabic", "Dari", "Farsi", "Punjabi", "Spanish", "Ukrainian"],
  },
  {
    city: "Winston-Salem", state: "NC",
    address: "4315 Dunmore Road", zip: "27107",
    phone: "(336) 724-2140",
    website: "https://www.rescue.org/united-states/winston-salem-nc",
    languages: ["English", "Arabic", "Burmese", "Kinyarwanda", "Spanish", "Swahili"],
  },
  {
    city: "Charlottesville", state: "VA",
    address: "2325 Commonwealth Drive, Suite G", zip: "22901",
    website: "https://www.rescue.org/united-states/charlottesville-va",
    languages: ["English", "Arabic", "Dari", "French", "Pashto", "Spanish", "Tigrinya"],
  },
  {
    city: "Tallahassee", state: "FL",
    address: "618 N. Gadsden Street", zip: "32303",
    website: "https://www.rescue.org/united-states/tallahassee-fl",
    languages: ["English", "Arabic", "French", "Haitian Creole", "Spanish", "Swahili"],
  },
];

// ── Category urgency rules ────────────────────────────────────────────────────

const CATEGORY_URGENCY: Record<Category, boolean> = {
  shelter:  true,
  medical:  true,
  food:     false,
  legal:    false,
  language: false,
};

const CATEGORIES: Category[] = ["shelter", "food", "medical", "legal", "language"];

// ── Build rows ────────────────────────────────────────────────────────────────

async function buildRows(office: IrcOffice): Promise<ResourceRow[]> {
  let lat = office.lat;
  let lng = office.lng;

  if (!lat || !lng) {
    const full = `${office.address}, ${office.city}, ${office.state} ${office.zip}`;
    let coords = await geocode(full);
    // If street address fails, fall back to org name + city search
    if (!coords) {
      coords = await geocode(`International Rescue Committee ${office.city} ${office.state}`);
    }
    if (coords) { lat = coords.lat; lng = coords.lng; }
    else {
      console.warn(`  ⚠ Could not geocode: ${full}`);
      return [];
    }
  }

  const baseName = `IRC in ${office.city}`;

  return CATEGORIES.map(cat => ({
    name:      baseName,
    category:  cat,
    status:    "open",
    address:   office.address,
    city:      office.city,
    state:     office.state,
    zip:       office.zip,
    lat:       lat!,
    lng:       lng!,
    phone:     office.phone,
    website:   office.website,
    languages: office.languages,
    urgent:    CATEGORY_URGENCY[cat],
    verified:  true,
  }));
}

// ── Dedup + insert ────────────────────────────────────────────────────────────

async function loadExistingKeys(): Promise<Set<string>> {
  const { data, error } = await supabase.from("resources").select("name, zip");
  if (error) { console.warn("Could not load existing keys:", error.message); return new Set(); }
  return new Set((data ?? []).map(r => `${r.name.toLowerCase()}|${(r.zip ?? "").trim()}`));
}

async function insertBatch(rows: ResourceRow[], existing: Set<string>): Promise<number> {
  const fresh = rows.filter(r => {
    const k = `${r.name.toLowerCase()}|${r.zip.trim()}`;
    if (existing.has(k)) return false;
    existing.add(k);
    return true;
  });
  if (!fresh.length) return 0;

  const { error } = await supabase.from("resources").insert(fresh);
  if (error) { console.error("  Insert error:", error.message); return 0; }
  return fresh.length;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nSeeding ${IRC_OFFICES.length} IRC offices × ${CATEGORIES.length} categories = up to ${IRC_OFFICES.length * CATEGORIES.length} rows\n`);

  const existing = await loadExistingKeys();
  let total = 0;

  for (const office of IRC_OFFICES) {
    process.stdout.write(`IRC in ${office.city}, ${office.state} … `);
    const rows = await buildRows(office);
    if (!rows.length) { console.log("skipped (no coords)"); continue; }

    const inserted = await insertBatch(rows, existing);
    console.log(`${inserted} rows inserted`);
    total += inserted;
  }

  console.log(`\n✓ Done. Total inserted: ${total}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
