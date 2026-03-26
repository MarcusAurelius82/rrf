/**
 * seed-211.ts
 * Pulls refugee/immigration services from the 211 Export V2 API
 * and upserts them into the Supabase resources table.
 *
 * Usage:
 *   npm run seed:211
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_211_API_KEY
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import type { ResourceCategory } from "../types/index";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TARGET_STATES = ["CA", "TX", "NY", "IL", "FL", "WA"] as const;

// 211 taxonomy codes for refugee/immigration services
const TAXONOMY_CODES = [
  "BH-1800",    // Refugee Resettlement Services
  "BH-1800.1000", // Refugee Resettlement Programs
  "BH-1800.2000", // Refugee Resettlement Assistance
  "LF-4900",    // Immigration & Naturalization Services
  "LF-4900.1400", // Asylum Seeker Assistance
  "LF-4900.2000", // Immigration Legal Assistance
  "LF-4900.0500", // Citizenship & Naturalization Services
  "LF-4900.1000", // Deportation Defense
  "LF-4900.1500", // Immigration Counseling
  "LF-4900.2500", // Visa Application Assistance
];

const BASE_URL = "https://api.211.org/resources/v2/export/organizations";
const PAGE_SIZE = 100;

// Continental US bounding box
const LAT_MIN = 24;
const LAT_MAX = 49;
const LNG_MIN = -125;
const LNG_MAX = -66;

// ---------------------------------------------------------------------------
// 211 API types (partial — only fields we use)
// ---------------------------------------------------------------------------

interface Api211Address {
  address1?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
}

interface Api211Phone {
  number?: string;
}

interface Api211Location {
  latitude?: number | string;
  longitude?: number | string;
  addresses?: Api211Address[];
  phones?: Api211Phone[];
}

interface Api211ServiceLanguages {
  codes?: string[];
}

interface Api211Service {
  taxonomies?: { code?: string; name?: string }[];
  languages?: Api211ServiceLanguages;
  name?: string;
}

interface Api211Org {
  id?: string;
  name?: string;
  description?: string;
  url?: string;
  locations?: Api211Location[];
  services?: Api211Service[];
}

interface Api211Response {
  organizations?: Api211Org[];
  total_count?: number;
  page?: number;
  per_page?: number;
}

// ---------------------------------------------------------------------------
// Category mapping
// ---------------------------------------------------------------------------

function mapCategory(services: Api211Service[] | undefined): ResourceCategory {
  if (!services || services.length === 0) return "medical";

  const allNames = services
    .flatMap((s) => [
      s.name?.toLowerCase() ?? "",
      ...(s.taxonomies?.map((t) => t.name?.toLowerCase() ?? "") ?? []),
    ])
    .join(" ");

  const allCodes = services
    .flatMap((s) => s.taxonomies?.map((t) => t.code ?? "") ?? [])
    .join(" ");

  // Legal: immigration legal assistance
  if (
    allCodes.match(/LF-49/) ||
    allNames.match(/legal|law|attorney|immigration|naturali|asylum|deporta|visa/)
  ) {
    return "legal";
  }

  // Language: interpretation / translation
  if (allNames.match(/interpret|translat|language|linguistic/)) {
    return "language";
  }

  // Shelter: housing, resettlement housing
  if (allNames.match(/shelter|housing|resettl|transitional living|residential/)) {
    return "shelter";
  }

  // Food
  if (allNames.match(/food|meal|nutrition|pantry|hunger/)) {
    return "food";
  }

  // Medical: explicit health/medical services
  if (allNames.match(/health|medical|clinic|hospital|mental|dental|vision|pharmacy/)) {
    return "medical";
  }

  // Default for refugee resettlement programs (BH-1800) → shelter
  return "shelter";
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchPage(
  state: string,
  taxonomyCode: string,
  page: number,
  apiKey: string
): Promise<Api211Response> {
  const url = new URL(`${BASE_URL}/${state}`);
  url.searchParams.set("taxonomy_code", taxonomyCode);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(PAGE_SIZE));

  const res = await fetch(url.toString(), {
    headers: {
      "X-Api-Key": apiKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`211 API ${res.status} for ${state}/${taxonomyCode} p${page}: ${text}`);
  }

  return res.json() as Promise<Api211Response>;
}

async function fetchAllForTaxonomy(
  state: string,
  taxonomyCode: string,
  apiKey: string
): Promise<Api211Org[]> {
  const orgs: Api211Org[] = [];
  let page = 1;

  while (true) {
    let data: Api211Response;
    try {
      data = await fetchPage(state, taxonomyCode, page, apiKey);
    } catch (err) {
      console.warn(`  [WARN] ${err}`);
      break;
    }

    const batch = data.organizations ?? [];
    orgs.push(...batch);

    const total = data.total_count ?? 0;
    if (orgs.length >= total || batch.length < PAGE_SIZE) break;
    page++;
  }

  return orgs;
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

interface ResourceRow {
  name: string;
  description: string | null;
  category: ResourceCategory;
  status: "open";
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  languages: string[] | null;
  urgent: boolean;
  verified: boolean;
}

function transform(org: Api211Org, stateCode: string): ResourceRow | null {
  const loc = org.locations?.[0];
  if (!loc) return null;

  const lat = parseFloat(String(loc.latitude ?? ""));
  const lng = parseFloat(String(loc.longitude ?? ""));

  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (lat < LAT_MIN || lat > LAT_MAX) return null;
  if (lng < LNG_MIN || lng > LNG_MAX) return null;

  const addr = loc.addresses?.[0];
  if (!addr?.address1 || !addr.city || !addr.postal_code) return null;

  const name = org.name?.trim();
  if (!name) return null;

  const phone = loc.phones?.[0]?.number?.trim() || null;
  const website = org.url?.trim() || null;

  const langCodes =
    org.services?.flatMap((s) => s.languages?.codes ?? []).filter(Boolean) ?? [];
  const languages = langCodes.length > 0 ? [...new Set(langCodes)] : null;

  return {
    name,
    description: org.description?.trim() || null,
    category: mapCategory(org.services),
    status: "open",
    address: addr.address1.trim(),
    city: addr.city.trim(),
    state: (addr.state_province ?? stateCode).toUpperCase(),
    zip: addr.postal_code.trim().slice(0, 10),
    lat,
    lng,
    phone,
    website,
    languages,
    urgent: false,
    verified: false,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const apiKey = process.env.NEXT_PUBLIC_211_API_KEY;
  if (!apiKey) {
    console.error("ERROR: NEXT_PUBLIC_211_API_KEY is not set");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let totalFetched = 0;
  let totalInserted = 0;
  let totalSkipped = 0;

  for (const state of TARGET_STATES) {
    console.log(`\n=== Processing state: ${state} ===`);

    // Deduplicate across taxonomy codes within a state using name+zip key
    const seenThisState = new Set<string>();
    const rows: ResourceRow[] = [];

    for (const code of TAXONOMY_CODES) {
      process.stdout.write(`  Fetching taxonomy ${code}...`);
      const orgs = await fetchAllForTaxonomy(state, code, apiKey);
      process.stdout.write(` ${orgs.length} orgs\n`);
      totalFetched += orgs.length;

      for (const org of orgs) {
        const row = transform(org, state);
        if (!row) {
          totalSkipped++;
          continue;
        }

        const key = `${row.name.toLowerCase()}|${row.zip}`;
        if (seenThisState.has(key)) continue;
        seenThisState.add(key);

        rows.push(row);
      }
    }

    if (rows.length === 0) {
      console.log(`  No valid rows for ${state}, skipping upsert.`);
      continue;
    }

    console.log(`  Upserting ${rows.length} rows into Supabase...`);

    // Upsert in batches of 50 to stay within Supabase limits
    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);

      const { error, count } = await supabase
        .from("resources")
        .upsert(batch, {
          onConflict: "name,zip",
          count: "exact",
        });

      if (error) {
        console.error(`  [ERROR] Upsert batch ${i / BATCH + 1}:`, error.message);
        totalSkipped += batch.length;
      } else {
        totalInserted += count ?? batch.length;
      }
    }

    console.log(`  Done: ${rows.length} rows upserted for ${state}.`);
  }

  console.log("\n=== Seed complete ===");
  console.log(`  Records fetched : ${totalFetched}`);
  console.log(`  Records inserted: ${totalInserted}`);
  console.log(`  Records skipped : ${totalSkipped}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
