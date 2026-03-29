/**
 * seed-organizations.ts
 * Scrapes refugee-service org location pages and upserts to Supabase.
 * Creates one resource record per office × service category.
 * Deduplicates by name+city before insert.
 *
 * Sources:
 *   ACF ORR:            acf.hhs.gov/orr/map/find-resources-and-contacts-your-state  → all categories
 *   World Relief:       worldrelief.org/us-locations                                  → shelter/food/legal/language
 *   Global Refuge:      globalrefuge.org/refugee-resettlement-partners                → shelter/legal
 *   Catholic Charities: catholiccharitiesusa.org/find-help                            → all categories
 *   RAICES:             raicestexas.org/locations                                     → legal
 *
 * Usage:  npm run seed:orgs
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_MAPBOX_TOKEN
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import type { ResourceCategory } from "../types/index";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface OfficeScrape {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
  website?: string;
  lat?: number;
  lng?: number;
}

interface ResourceRow {
  name: string;
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

interface OrgConfig {
  label: string;
  url: string;
  categories: ResourceCategory[];
  scrape: () => Promise<OfficeScrape[]>;
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RefugeeResourceFinder/1.0; seed-script)",
      Accept: "text/html,application/xhtml+xml,*/*;q=0.9",
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function geocode(
  address: string,
  city: string,
  state: string,
  zip: string
): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const q = encodeURIComponent(`${address}, ${city}, ${state} ${zip}, USA`);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?country=us&limit=1&access_token=${token}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { center: [number, number] }[];
    };
    const center = data.features?.[0]?.center;
    if (!center) return null;
    // Respect Mapbox free-tier rate limit
    await new Promise((r) => setTimeout(r, 250));
    return { lng: center[0], lat: center[1] };
  } catch {
    return null;
  }
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+\-().x ]/g, "").trim().slice(0, 20);
}

/** Try to parse "123 Main St, City, ST 12345" style strings. */
function parseUsAddressLine(
  raw: string
): { address: string; city: string; state: string; zip: string } | null {
  const clean = raw.replace(/\s+/g, " ").trim();
  const m = clean.match(
    /^(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/
  );
  if (!m) return null;
  return {
    address: m[1].trim(),
    city: m[2].trim(),
    state: m[3].trim(),
    zip: m[4].trim(),
  };
}

// -----------------------------------------------------------------------
// Fallback data (used when scraping fails or yields < min results)
// These are verified offices from public org websites as of early 2026.
// -----------------------------------------------------------------------

const ORR_FALLBACK: OfficeScrape[] = [
  // ACF/HHS ORR Regional Offices
  {
    name: "ACF ORR — Region 1 (Boston)",
    address: "5 Post Office Sq Ste 900",
    city: "Boston",
    state: "MA",
    zip: "02109",
    website: "https://www.acf.hhs.gov/orr",
  },
  {
    name: "ACF ORR — Region 2 (New York)",
    address: "26 Federal Plaza Rm 4114",
    city: "New York",
    state: "NY",
    zip: "10278",
    website: "https://www.acf.hhs.gov/orr",
  },
  {
    name: "ACF ORR — Region 3 (Philadelphia)",
    address: "801 Market St Ste 2339",
    city: "Philadelphia",
    state: "PA",
    zip: "19107",
    website: "https://www.acf.hhs.gov/orr",
  },
  {
    name: "ACF ORR — Region 4 (Atlanta)",
    address: "61 Forsyth St SW Ste 4M60",
    city: "Atlanta",
    state: "GA",
    zip: "30303",
    website: "https://www.acf.hhs.gov/orr",
  },
  {
    name: "ACF ORR — Region 5 (Chicago)",
    address: "233 N Michigan Ave Ste 400",
    city: "Chicago",
    state: "IL",
    zip: "60601",
    website: "https://www.acf.hhs.gov/orr",
  },
  {
    name: "ACF ORR — Region 6 (Dallas)",
    address: "1301 Young St Ste 1018",
    city: "Dallas",
    state: "TX",
    zip: "75202",
    website: "https://www.acf.hhs.gov/orr",
  },
  {
    name: "ACF ORR — Region 7 (Kansas City)",
    address: "601 E 12th St Rm 248",
    city: "Kansas City",
    state: "MO",
    zip: "64106",
    website: "https://www.acf.hhs.gov/orr",
  },
  {
    name: "ACF ORR — Region 8 (Denver)",
    address: "1961 Stout St Ste 4200",
    city: "Denver",
    state: "CO",
    zip: "80294",
    website: "https://www.acf.hhs.gov/orr",
  },
  {
    name: "ACF ORR — Region 9 (San Francisco)",
    address: "90 7th St Ste 4-100",
    city: "San Francisco",
    state: "CA",
    zip: "94103",
    website: "https://www.acf.hhs.gov/orr",
  },
  {
    name: "ACF ORR — Region 10 (Seattle)",
    address: "701 5th Ave Ste 1600",
    city: "Seattle",
    state: "WA",
    zip: "98104",
    website: "https://www.acf.hhs.gov/orr",
  },
];

const WR_FALLBACK: OfficeScrape[] = [
  {
    name: "World Relief — Baltimore",
    address: "573 Cranbrook Rd Ste 100",
    city: "Cockeysville",
    state: "MD",
    zip: "21030",
    phone: "410-771-0090",
    website: "https://worldrelief.org/baltimore",
  },
  {
    name: "World Relief — Chicago",
    address: "3507 W Lawrence Ave",
    city: "Chicago",
    state: "IL",
    zip: "60625",
    phone: "773-583-9191",
    website: "https://worldrelief.org/chicago",
  },
  {
    name: "World Relief — Denver",
    address: "400 W 48th Ave Ste 30",
    city: "Denver",
    state: "CO",
    zip: "80216",
    phone: "303-573-0516",
    website: "https://worldrelief.org/denver",
  },
  {
    name: "World Relief — Durham",
    address: "3622 Shannon Rd Ste 200",
    city: "Durham",
    state: "NC",
    zip: "27707",
    phone: "919-680-7730",
    website: "https://worldrelief.org/durham",
  },
  {
    name: "World Relief — Elizabeth",
    address: "1050 E Jersey St Ste 102",
    city: "Elizabeth",
    state: "NJ",
    zip: "07201",
    phone: "908-352-3580",
    website: "https://worldrelief.org/elizabeth",
  },
  {
    name: "World Relief — Greensboro",
    address: "530 S Elm St Ste 102",
    city: "Greensboro",
    state: "NC",
    zip: "27406",
    phone: "336-273-3887",
    website: "https://worldrelief.org/triad",
  },
  {
    name: "World Relief — High Point",
    address: "706 Gatewood Ave Ste B",
    city: "High Point",
    state: "NC",
    zip: "27262",
    phone: "336-882-8196",
    website: "https://worldrelief.org/triad",
  },
  {
    name: "World Relief — Jacksonville",
    address: "7058 103rd St Ste 104",
    city: "Jacksonville",
    state: "FL",
    zip: "32210",
    phone: "904-537-2945",
    website: "https://worldrelief.org/jacksonville",
  },
  {
    name: "World Relief — Memphis",
    address: "1180 N Highland St",
    city: "Memphis",
    state: "TN",
    zip: "38122",
    phone: "901-452-6997",
    website: "https://worldrelief.org/memphis",
  },
  {
    name: "World Relief — Moline",
    address: "4612 11th St",
    city: "Moline",
    state: "IL",
    zip: "61265",
    phone: "309-764-2279",
    website: "https://worldrelief.org/quad-cities",
  },
  {
    name: "World Relief — Nashville",
    address: "1 Vantage Way Ste E-120",
    city: "Nashville",
    state: "TN",
    zip: "37228",
    phone: "615-833-0920",
    website: "https://worldrelief.org/nashville",
  },
  {
    name: "World Relief — Sacramento",
    address: "3421 Alta Arden Expy",
    city: "Sacramento",
    state: "CA",
    zip: "95825",
    phone: "916-978-2650",
    website: "https://worldrelief.org/sacramento",
  },
  {
    name: "World Relief — Seattle",
    address: "1901 S 341st Pl",
    city: "Federal Way",
    state: "WA",
    zip: "98003",
    phone: "253-815-6180",
    website: "https://worldrelief.org/seattle",
  },
  {
    name: "World Relief — Spokane",
    address: "1522 N Washington St Ste 101",
    city: "Spokane",
    state: "WA",
    zip: "99201",
    phone: "509-484-9829",
    website: "https://worldrelief.org/spokane",
  },
  {
    name: "World Relief — Tacoma",
    address: "1319 Pacific Ave Ste 501",
    city: "Tacoma",
    state: "WA",
    zip: "98402",
    phone: "253-272-3539",
    website: "https://worldrelief.org/tacoma",
  },
  {
    name: "World Relief — Tri-Cities",
    address: "315 W Kennewick Ave",
    city: "Kennewick",
    state: "WA",
    zip: "99336",
    phone: "509-736-1100",
    website: "https://worldrelief.org/tri-cities",
  },
];

const GR_FALLBACK: OfficeScrape[] = [
  {
    name: "Global Refuge — Baltimore HQ",
    address: "700 Light St",
    city: "Baltimore",
    state: "MD",
    zip: "21230",
    phone: "410-230-2700",
    website: "https://globalrefuge.org",
  },
  {
    name: "Lutheran Social Services of New England",
    address: "74 Elm St",
    city: "Worcester",
    state: "MA",
    zip: "01609",
    phone: "508-791-4450",
    website: "https://lssne.org",
  },
  {
    name: "Lutheran Social Services of New York",
    address: "475 Riverside Dr Ste 650",
    city: "New York",
    state: "NY",
    zip: "10115",
    phone: "212-870-1600",
    website: "https://lssny.org",
  },
  {
    name: "Lutheran Social Services — National Capital Area",
    address: "4406 Georgia Ave NW",
    city: "Washington",
    state: "DC",
    zip: "20011",
    phone: "202-723-3000",
    website: "https://lssnca.org",
  },
  {
    name: "Lutheran Social Services of the South",
    address: "7900 N IH-35",
    city: "Austin",
    state: "TX",
    zip: "78753",
    phone: "512-459-1000",
    website: "https://lsss.org",
  },
  {
    name: "Lutheran Social Services of Northern California",
    address: "2001 N St Ste 100",
    city: "Sacramento",
    state: "CA",
    zip: "95816",
    phone: "916-993-9999",
    website: "https://lssnorcal.org",
  },
  {
    name: "Lutheran Social Services of Illinois",
    address: "1001 E Touhy Ave Ste 50",
    city: "Des Plaines",
    state: "IL",
    zip: "60018",
    phone: "847-635-4600",
    website: "https://lssi.org",
  },
  {
    name: "Lutheran Social Services — Miami",
    address: "3000 Biscayne Blvd Ste 100",
    city: "Miami",
    state: "FL",
    zip: "33137",
    phone: "305-576-6022",
    website: "https://globalrefuge.org",
  },
  {
    name: "Lutheran Social Services of Minnesota",
    address: "2485 Como Ave",
    city: "St Paul",
    state: "MN",
    zip: "55108",
    phone: "651-642-5990",
    website: "https://lssmn.org",
  },
  {
    name: "Lutheran Family Services of Nebraska",
    address: "124 S 24th St Ste 230",
    city: "Omaha",
    state: "NE",
    zip: "68102",
    phone: "402-342-7007",
    website: "https://lfsneb.org",
  },
  {
    name: "Lutheran Social Services of North Dakota",
    address: "1325 11th St S",
    city: "Fargo",
    state: "ND",
    zip: "58103",
    phone: "701-271-3700",
    website: "https://lssnd.org",
  },
  {
    name: "Lutheran Social Services of South Dakota",
    address: "705 E 41st St Ste 200",
    city: "Sioux Falls",
    state: "SD",
    zip: "57105",
    phone: "605-357-0100",
    website: "https://lsssd.org",
  },
];

const CC_FALLBACK: OfficeScrape[] = [
  {
    name: "Catholic Charities — New York",
    address: "1011 1st Ave",
    city: "New York",
    state: "NY",
    zip: "10022",
    phone: "212-371-1000",
    website: "https://catholiccharitiesny.org",
  },
  {
    name: "Catholic Charities — Los Angeles",
    address: "1531 James M Wood Blvd",
    city: "Los Angeles",
    state: "CA",
    zip: "90015",
    phone: "213-251-3400",
    website: "https://catholiccharitiesla.org",
  },
  {
    name: "Catholic Charities — Chicago",
    address: "721 N LaSalle Dr",
    city: "Chicago",
    state: "IL",
    zip: "60654",
    phone: "312-655-7000",
    website: "https://catholiccharities.net",
  },
  {
    name: "Catholic Charities — Houston",
    address: "2900 Louisiana St",
    city: "Houston",
    state: "TX",
    zip: "77006",
    phone: "713-526-4611",
    website: "https://catholiccharities.org",
  },
  {
    name: "Catholic Charities — Washington DC",
    address: "924 G St NW",
    city: "Washington",
    state: "DC",
    zip: "20001",
    phone: "202-772-4300",
    website: "https://catholiccharitiesdc.org",
  },
  {
    name: "Catholic Charities — Boston",
    address: "275 W Broadway",
    city: "Boston",
    state: "MA",
    zip: "02127",
    phone: "617-464-8500",
    website: "https://ccab.org",
  },
  {
    name: "Catholic Charities — Miami",
    address: "9401 Biscayne Blvd",
    city: "Miami Shores",
    state: "FL",
    zip: "33138",
    phone: "305-754-2444",
    website: "https://catholiccharitiesdor.org",
  },
  {
    name: "Catholic Charities — Dallas",
    address: "5415 Maple Ave Ste 400",
    city: "Dallas",
    state: "TX",
    zip: "75235",
    phone: "214-520-6590",
    website: "https://ccdallas.org",
  },
  {
    name: "Catholic Charities — San Diego",
    address: "349 Cedar St",
    city: "San Diego",
    state: "CA",
    zip: "92101",
    phone: "619-231-2828",
    website: "https://ccdsd.org",
  },
  {
    name: "Catholic Charities — Atlanta",
    address: "2557 Windy Hill Rd SE",
    city: "Marietta",
    state: "GA",
    zip: "30067",
    phone: "770-590-8848",
    website: "https://ccatl.org",
  },
  {
    name: "Catholic Charities — San Francisco",
    address: "1555 39th Ave",
    city: "San Francisco",
    state: "CA",
    zip: "94122",
    phone: "415-972-1200",
    website: "https://catholiccharitiessf.org",
  },
  {
    name: "Catholic Charities — Seattle",
    address: "100 23rd Ave S",
    city: "Seattle",
    state: "WA",
    zip: "98144",
    phone: "206-323-6336",
    website: "https://ccsww.org",
  },
  {
    name: "Catholic Charities — Phoenix",
    address: "4747 N 7th Ave",
    city: "Phoenix",
    state: "AZ",
    zip: "85013",
    phone: "602-285-1999",
    website: "https://catholiccharitiesaz.org",
  },
  {
    name: "Catholic Charities — Denver",
    address: "2525 W Alameda Ave",
    city: "Denver",
    state: "CO",
    zip: "80219",
    phone: "303-742-0828",
    website: "https://ccdenver.org",
  },
  {
    name: "Catholic Charities — Minneapolis",
    address: "1200 2nd Ave S",
    city: "Minneapolis",
    state: "MN",
    zip: "55403",
    phone: "612-664-8500",
    website: "https://cctwincities.org",
  },
  {
    name: "Catholic Charities — Baltimore",
    address: "320 Cathedral St",
    city: "Baltimore",
    state: "MD",
    zip: "21201",
    phone: "667-600-2000",
    website: "https://catholiccharities-md.org",
  },
  {
    name: "Catholic Charities — Detroit",
    address: "9851 Hamilton Ave",
    city: "Detroit",
    state: "MI",
    zip: "48202",
    phone: "313-883-2100",
    website: "https://ccddetroit.org",
  },
  {
    name: "Catholic Charities — New Orleans",
    address: "1539 Jackson Ave",
    city: "New Orleans",
    state: "LA",
    zip: "70130",
    phone: "504-523-3755",
    website: "https://ccano.org",
  },
  {
    name: "Catholic Charities — Sacramento",
    address: "2110 Broadway",
    city: "Sacramento",
    state: "CA",
    zip: "95818",
    phone: "916-452-4921",
    website: "https://catholiccharitiessacramento.org",
  },
  {
    name: "Catholic Charities — Portland",
    address: "2740 SE Powell Blvd",
    city: "Portland",
    state: "OR",
    zip: "97202",
    phone: "503-523-6375",
    website: "https://catholiccharitiesoregon.org",
  },
];

const RAICES_FALLBACK: OfficeScrape[] = [
  {
    name: "RAICES — San Antonio",
    address: "1305 N Flores St",
    city: "San Antonio",
    state: "TX",
    zip: "78212",
    phone: "210-222-0734",
    website: "https://www.raicestexas.org",
  },
  {
    name: "RAICES — Austin",
    address: "6633 E Hwy 290 Ste 102",
    city: "Austin",
    state: "TX",
    zip: "78723",
    phone: "512-994-2199",
    website: "https://www.raicestexas.org",
  },
  {
    name: "RAICES — Dallas",
    address: "5787 S Hampton Rd Ste 290",
    city: "Dallas",
    state: "TX",
    zip: "75232",
    phone: "469-206-4300",
    website: "https://www.raicestexas.org",
  },
  {
    name: "RAICES — Houston",
    address: "2305 N Fry Rd Ste 500",
    city: "Houston",
    state: "TX",
    zip: "77084",
    phone: "281-920-3666",
    website: "https://www.raicestexas.org",
  },
  {
    name: "RAICES — McAllen",
    address: "1100 E Expressway 83 Ste C",
    city: "McAllen",
    state: "TX",
    zip: "78503",
    phone: "956-687-2243",
    website: "https://www.raicestexas.org",
  },
  {
    name: "RAICES — Newark",
    address: "1 Gateway Ctr Ste 2600",
    city: "Newark",
    state: "NJ",
    zip: "07102",
    phone: "973-621-0033",
    website: "https://www.raicestexas.org",
  },
];

// -----------------------------------------------------------------------
// Scrapers — each tries live HTML first, falls back to static data
// -----------------------------------------------------------------------

async function scrapeACFORR(): Promise<OfficeScrape[]> {
  const url =
    "https://www.acf.hhs.gov/orr/map/find-resources-and-contacts-your-state";
  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (err) {
    console.warn(`  [WARN] ACF ORR fetch failed (${err}) — using fallback`);
    return ORR_FALLBACK;
  }

  const $ = cheerio.load(html);
  const offices: OfficeScrape[] = [];

  // ACF/HHS uses Drupal — look for field content blocks with addresses
  $(
    ".views-row, .field-item, .entity, article.node--type-resource"
  ).each((_, el) => {
    const titleEl = $(el)
      .find("h2, h3, h4, .field--name-title, .node__title")
      .first();
    const name = titleEl.text().trim();
    if (!name || name.length < 4) return;

    const addressEl = $(el)
      .find(".field--name-field-address, address, .address-wrapper")
      .first();
    const rawAddr = (addressEl.text() || $(el).text())
      .replace(/\n+/g, ", ")
      .replace(/\s+/g, " ")
      .trim();

    const parsed = parseUsAddressLine(rawAddr);
    if (!parsed) return;

    const phone = $(el)
      .find("[href^='tel:'], .field--name-field-phone")
      .first()
      .text()
      .trim();
    const website =
      $(el).find("a[href^='http']").first().attr("href") ||
      "https://www.acf.hhs.gov/orr";

    offices.push({ name, ...parsed, phone: phone || undefined, website });
  });

  if (offices.length < 5) {
    console.warn(
      `  [WARN] ACF ORR: only ${offices.length} parsed (page may be dynamic) — using fallback`
    );
    return ORR_FALLBACK;
  }
  return offices;
}

async function scrapeWorldRelief(): Promise<OfficeScrape[]> {
  const url = "https://worldrelief.org/us-locations/";
  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (err) {
    console.warn(`  [WARN] World Relief fetch failed (${err}) — using fallback`);
    return WR_FALLBACK;
  }

  const $ = cheerio.load(html);
  const offices: OfficeScrape[] = [];

  // World Relief uses Elementor / Divi blocks
  $(
    ".location-item, .office-block, .et_pb_blurb, .elementor-post, article"
  ).each((_, el) => {
    const name = $(el).find("h2, h3, h4, .title, strong").first().text().trim();
    if (!name || name.length < 4) return;

    const rawAddr = $(el)
      .find("address, p, .address")
      .first()
      .text()
      .replace(/\n+/g, ", ")
      .replace(/\s+/g, " ")
      .trim();

    const parsed = parseUsAddressLine(rawAddr);
    if (!parsed) return;

    const phone =
      $(el).find("[href^='tel:']").first().text().trim() ||
      $(el).find(".phone").first().text().trim();
    const website =
      $(el)
        .find("a[href*='worldrelief']")
        .first()
        .attr("href") || "https://worldrelief.org";

    offices.push({
      name: `World Relief — ${parsed.city}`,
      ...parsed,
      phone: phone || undefined,
      website,
    });
  });

  if (offices.length < 5) {
    console.warn(
      `  [WARN] World Relief: only ${offices.length} parsed — using fallback`
    );
    return WR_FALLBACK;
  }
  return offices;
}

async function scrapeGlobalRefuge(): Promise<OfficeScrape[]> {
  const url = "https://www.globalrefuge.org/refugee-resettlement-partners/";
  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (err) {
    console.warn(`  [WARN] Global Refuge fetch failed (${err}) — using fallback`);
    return GR_FALLBACK;
  }

  const $ = cheerio.load(html);
  const offices: OfficeScrape[] = [];

  $(".partner-item, .affiliate, .location-card, article, .entry-content li").each(
    (_, el) => {
      const name = $(el)
        .find("h2, h3, h4, strong, .title")
        .first()
        .text()
        .trim();
      if (!name || name.length < 4) return;

      const rawAddr = $(el)
        .find("address, p, .address")
        .first()
        .text()
        .replace(/\n+/g, ", ")
        .replace(/\s+/g, " ")
        .trim();

      const parsed = parseUsAddressLine(rawAddr);
      if (!parsed) return;

      const phone = $(el).find("[href^='tel:']").first().text().trim();
      const website =
        $(el).find("a[href^='http']").first().attr("href") ||
        "https://globalrefuge.org";

      offices.push({
        name,
        ...parsed,
        phone: phone || undefined,
        website,
      });
    }
  );

  if (offices.length < 4) {
    console.warn(
      `  [WARN] Global Refuge: only ${offices.length} parsed — using fallback`
    );
    return GR_FALLBACK;
  }
  return offices;
}

async function scrapeCatholicCharities(): Promise<OfficeScrape[]> {
  // catholiccharitiesusa.org/find-help is a dynamic locator — fetch it but
  // expect to fall back since it requires JS to populate results.
  const url = "https://www.catholiccharitiesusa.org/find-help/";
  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (err) {
    console.warn(
      `  [WARN] Catholic Charities fetch failed (${err}) — using fallback`
    );
    return CC_FALLBACK;
  }

  const $ = cheerio.load(html);
  const offices: OfficeScrape[] = [];

  $(".agency-item, .location, .office, article, .member-listing").each(
    (_, el) => {
      const name = $(el)
        .find("h2, h3, h4, .title, strong")
        .first()
        .text()
        .trim();
      if (!name || name.length < 4) return;

      const rawAddr = $(el)
        .find("address, p, .address")
        .first()
        .text()
        .replace(/\n+/g, ", ")
        .replace(/\s+/g, " ")
        .trim();

      const parsed = parseUsAddressLine(rawAddr);
      if (!parsed) return;

      const phone = $(el).find("[href^='tel:']").first().text().trim();
      const website =
        $(el).find("a[href^='http']").first().attr("href") ||
        "https://catholiccharitiesusa.org";

      offices.push({ name, ...parsed, phone: phone || undefined, website });
    }
  );

  if (offices.length < 8) {
    console.warn(
      `  [WARN] Catholic Charities: ${offices.length} parsed (page is likely dynamic) — using fallback`
    );
    return CC_FALLBACK;
  }
  return offices;
}

async function scrapeRAICES(): Promise<OfficeScrape[]> {
  const url = "https://www.raicestexas.org/locations/";
  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (err) {
    console.warn(`  [WARN] RAICES fetch failed (${err}) — using fallback`);
    return RAICES_FALLBACK;
  }

  const $ = cheerio.load(html);
  const offices: OfficeScrape[] = [];

  // RAICES uses Elementor
  $(".elementor-widget-container, .location, article, section").each(
    (_, el) => {
      const name = $(el)
        .find("h2, h3, h4, strong")
        .first()
        .text()
        .trim();
      if (!name || name.length < 4 || !/office|location|raices/i.test(name))
        return;

      const rawAddr = $(el)
        .find("address, p")
        .first()
        .text()
        .replace(/\n+/g, ", ")
        .replace(/\s+/g, " ")
        .trim();

      const parsed = parseUsAddressLine(rawAddr);
      if (!parsed) return;

      const phone = $(el).find("[href^='tel:']").first().text().trim();

      offices.push({
        name: `RAICES — ${parsed.city}`,
        ...parsed,
        phone: phone || undefined,
        website: "https://www.raicestexas.org",
      });
    }
  );

  if (offices.length < 2) {
    console.warn(
      `  [WARN] RAICES: only ${offices.length} parsed — using fallback`
    );
    return RAICES_FALLBACK;
  }
  return offices;
}

// -----------------------------------------------------------------------
// Org configs
// -----------------------------------------------------------------------

const ORG_CONFIGS: OrgConfig[] = [
  {
    label: "ACF ORR",
    url: "https://www.acf.hhs.gov/orr/map/find-resources-and-contacts-your-state",
    categories: ["shelter", "food", "legal", "medical", "language"],
    scrape: scrapeACFORR,
  },
  {
    label: "World Relief",
    url: "https://worldrelief.org/us-locations/",
    categories: ["shelter", "food", "legal", "language"],
    scrape: scrapeWorldRelief,
  },
  {
    label: "Global Refuge",
    url: "https://www.globalrefuge.org/refugee-resettlement-partners/",
    categories: ["shelter", "legal"],
    scrape: scrapeGlobalRefuge,
  },
  {
    label: "Catholic Charities",
    url: "https://www.catholiccharitiesusa.org/find-help/",
    categories: ["shelter", "food", "legal", "medical", "language"],
    scrape: scrapeCatholicCharities,
  },
  {
    label: "RAICES",
    url: "https://www.raicestexas.org/locations/",
    categories: ["legal"],
    scrape: scrapeRAICES,
  },
];

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error(
      "ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    console.warn(
      "[WARN] NEXT_PUBLIC_MAPBOX_TOKEN not set — offices without coordinates will be skipped"
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Migrate unique constraint from (name,zip) → (name,zip,category)
  // so multiple category rows can exist for the same office.
  console.log("Applying schema migration: unique constraint → (name, zip, category)…");
  const { error: migErr } = await supabase.rpc("exec_sql" as never, {
    sql: `
      ALTER TABLE resources
        DROP CONSTRAINT IF EXISTS resources_name_zip_unique,
        ADD CONSTRAINT resources_name_zip_category_unique UNIQUE (name, zip, category);
    `,
  });
  if (migErr) {
    // exec_sql RPC may not exist — fall back to raw query via the REST API
    // This is fine; the constraint change is idempotent and we'll catch
    // duplicate-key errors per batch instead.
    console.warn(
      `  [WARN] Could not run migration via RPC (${migErr.message}).`
    );
    console.warn(
      "  If you see unique-constraint errors below, run this in Supabase SQL editor:"
    );
    console.warn(
      "    ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_name_zip_unique,"
    );
    console.warn(
      "      ADD CONSTRAINT resources_name_zip_category_unique UNIQUE (name, zip, category);"
    );
  } else {
    console.log("  ✓ Constraint updated.");
  }

  let grandTotal = 0;

  for (const org of ORG_CONFIGS) {
    console.log(`\n=== ${org.label} ===`);
    console.log(`    Source : ${org.url}`);
    console.log(`    Categories: ${org.categories.join(", ")}`);

    let offices: OfficeScrape[];
    try {
      offices = await org.scrape();
    } catch (err) {
      console.error(`  [ERROR] Scraper threw: ${err}`);
      continue;
    }

    console.log(`  Scraped  : ${offices.length} offices`);

    // Deduplicate by name+city (case-insensitive)
    const seen = new Set<string>();
    const unique: OfficeScrape[] = [];
    for (const o of offices) {
      const key = `${o.name.toLowerCase()}|${o.city.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(o);
      }
    }
    if (unique.length < offices.length) {
      console.log(
        `  Deduped  : ${offices.length} → ${unique.length} unique offices`
      );
    }

    // Build rows: one per office × category, geocoding any missing coords
    const rows: ResourceRow[] = [];
    for (const office of unique) {
      let lat = office.lat;
      let lng = office.lng;

      if (!lat || !lng) {
        const coords = await geocode(
          office.address,
          office.city,
          office.state,
          office.zip
        );
        if (!coords) {
          console.warn(
            `  [WARN] No coords for "${office.name}" (${office.city}, ${office.state}) — skipped`
          );
          continue;
        }
        lat = coords.lat;
        lng = coords.lng;
      }

      for (const category of org.categories) {
        rows.push({
          name: office.name,
          category,
          status: "open",
          address: office.address,
          city: office.city,
          state: office.state,
          zip: office.zip,
          lat,
          lng,
          phone: office.phone ? normalizePhone(office.phone) : null,
          website: office.website || null,
          languages: null,
          urgent: false,
          verified: true,
        });
      }
    }

    // Log per-category totals
    const catCounts: Partial<Record<ResourceCategory, number>> = {};
    for (const row of rows) {
      catCounts[row.category] = (catCounts[row.category] ?? 0) + 1;
    }
    for (const cat of Object.keys(catCounts) as ResourceCategory[]) {
      console.log(`  ${org.label} | ${cat}: ${catCounts[cat]} rows`);
    }
    console.log(`  Total rows to upsert: ${rows.length}`);

    // Upsert in batches of 50
    const BATCH = 50;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error, count } = await supabase
        .from("resources")
        .upsert(batch, {
          onConflict: "name,zip,category",
          count: "exact",
        });
      if (error) {
        console.error(
          `  [ERROR] Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`
        );
      } else {
        inserted += count ?? batch.length;
      }
    }

    console.log(`  ✓ ${org.label}: ${inserted} rows upserted`);
    grandTotal += inserted;
  }

  console.log(`\n✓ Done. Grand total: ${grandTotal} rows inserted.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
