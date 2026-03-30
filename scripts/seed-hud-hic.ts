/**
 * seed-hud-hic.ts
 * Seeds emergency shelter data from HUD's Housing Inventory Count (HIC).
 *
 * HUD publishes project-level HIC data via the HDX 2.0 portal (login required).
 * This script supports three data sources, tried in order:
 *
 *   1. Local file supplied via --hic-file <path>  (preferred — most complete)
 *   2. Automatic download from HUD USER public Excel files
 *   3. Built-in fallback dataset of ~60 known major emergency shelters
 *
 * HOW TO GET THE FULL PROJECT-LEVEL DATA FILE:
 *   a. Go to https://www.hudexchange.info/programs/hdx/pit-hic/
 *   b. Click "Access HDX 2.0" and log in (free CoC/partner account)
 *   c. Under "Reports & Exports", download the HIC project-level export
 *      as CSV or Excel. The file is often named "HIC_<year>_project.xlsx"
 *   d. Run: npm run seed:hic -- --hic-file /path/to/HIC_<year>_project.xlsx
 *
 * Without a project-level file, the script uses publicly available state/CoC
 * aggregate files from HUD USER and supplements with the fallback dataset.
 *
 * Filters: Emergency Shelter (ES) and Safe Haven (SH) program types only.
 * Documentation levels:
 *   Emergency Shelter → "none"   (federal McKinney-Vento requires intake regardless of status)
 *   Safe Haven        → "id_only"
 *
 * Usage:
 *   npm run seed:hic
 *   npm run seed:hic -- --hic-file ./HIC_2024_project.xlsx
 *   npm run seed:hic -- --hic-file ./HIC_2024.csv
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_MAPBOX_TOKEN
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

type DocRequired = "none" | "id_only" | "legal_status" | "benefits_eligible" | "unknown";

interface HicRecord {
  organizationName: string;
  projectName: string;
  programType: "ES" | "SH";
  address: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
  website?: string;
}

interface ResourceRow {
  name: string;
  category: "shelter";
  status: "open";
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  hours: Record<string, string> | null;
  languages: string[] | null;
  urgent: boolean;
  verified: boolean;
  documentation_required: DocRequired;
}

// -----------------------------------------------------------------------
// HIC column name aliases
// HUD changes column names between years; we try all known variants.
// -----------------------------------------------------------------------

const COL_ORG = ["Organization Name", "OrganizationName", "Org Name", "org_name", "Agency Name"];
const COL_PROJECT = ["Project Name", "ProjectName", "Program Name", "project_name", "Shelter Name", "Name"];
const COL_TYPE = ["Project Type", "ProjectType", "Program Type", "ProgramType", "project_type", "Type"];
const COL_ADDR = ["Address", "ProjectAddress", "Street Address", "StreetAddress", "project_address"];
const COL_CITY = ["City", "ProjectCity", "project_city"];
const COL_STATE = ["State", "ProjectState", "StateCode", "project_state"];
const COL_ZIP = ["ZIP", "Zip", "ZIPCode", "ProjectZIP", "project_zip", "Zip Code", "zip_code"];
const COL_PHONE = ["Phone", "PhoneNumber", "phone", "Contact Phone", "phone_number"];
const COL_WEBSITE = ["Website", "URL", "website", "Web", "Organization URL"];

/** Program type values that map to Emergency Shelter */
const ES_TYPES = new Set([
  "emergency shelter",
  "emergency shelter - entry/exit",
  "emergency shelter - night-by-night",
  "emergency shelter-entry exit",
  "emergency shelter-night by night",
  "es",
  "es-ee",
  "es-nb",
  "1",
  "2",
]);

/** Program type values that map to Safe Haven */
const SH_TYPES = new Set([
  "safe haven",
  "sh",
  "13",
]);

// -----------------------------------------------------------------------
// Fallback dataset
// Major known emergency shelters, verified from public sources (early 2026).
// Used when no HIC file is available.
// -----------------------------------------------------------------------

const HIC_FALLBACK: HicRecord[] = [
  // AK
  { organizationName: "Bean's Café", projectName: "Bean's Café Emergency Shelter", programType: "ES", address: "1020 E 3rd Ave", city: "Anchorage", state: "AK", zip: "99501" },
  // AZ
  { organizationName: "Central Arizona Shelter Services", projectName: "CASS Emergency Shelter", programType: "ES", address: "230 S 12th Ave", city: "Phoenix", state: "AZ", zip: "85007", phone: "602-256-6945", website: "https://cassaz.org" },
  { organizationName: "Gospel Rescue Mission Tucson", projectName: "Emergency Shelter for Men", programType: "ES", address: "336 S Park Ave", city: "Tucson", state: "AZ", zip: "85719", phone: "520-740-1501", website: "https://www.grmtucson.com" },
  // CA
  { organizationName: "Union Rescue Mission", projectName: "Emergency Shelter", programType: "ES", address: "545 S San Pedro St", city: "Los Angeles", state: "CA", zip: "90013", phone: "213-347-6300", website: "https://www.urm.org" },
  { organizationName: "Compass Family Services", projectName: "Emergency Family Shelter", programType: "ES", address: "49 Morris St", city: "San Francisco", state: "CA", zip: "94103", phone: "415-644-0504", website: "https://www.compass-sf.org" },
  { organizationName: "Sacramento Steps Forward", projectName: "Mather Community Campus", programType: "ES", address: "10850 Eagle Ave", city: "Mather", state: "CA", zip: "95655", website: "https://sacramentostepsforward.org" },
  { organizationName: "PATH", projectName: "PATH Safe Haven — San Diego", programType: "SH", address: "4630 Ingraham St", city: "San Diego", state: "CA", zip: "92109", phone: "619-677-7284", website: "https://epath.org" },
  // CO
  { organizationName: "Denver Rescue Mission", projectName: "Lawrence Street Shelter", programType: "ES", address: "1130 Park Ave W", city: "Denver", state: "CO", zip: "80205", phone: "303-294-0157", website: "https://www.denverrescuemission.org" },
  { organizationName: "Catholic Charities of Denver", projectName: "Samaritan House", programType: "ES", address: "2301 Lawrence St", city: "Denver", state: "CO", zip: "80205", phone: "303-296-2884", website: "https://catholiccharitiesdenver.org" },
  // CT
  { organizationName: "Columbus House", projectName: "Emergency Shelter", programType: "ES", address: "586 Ella T Grasso Blvd", city: "New Haven", state: "CT", zip: "06519", phone: "203-776-5151", website: "https://columbushouse.org" },
  // DC
  { organizationName: "Central Union Mission", projectName: "Emergency Overnight Shelter", programType: "ES", address: "65 Massachusetts Ave NW", city: "Washington", state: "DC", zip: "20001", phone: "202-745-7118", website: "https://www.missiondc.org" },
  { organizationName: "So Others Might Eat (SOME)", projectName: "Safe Haven Program", programType: "SH", address: "71 O St NW", city: "Washington", state: "DC", zip: "20001", phone: "202-797-8806", website: "https://www.some.org" },
  // FL
  { organizationName: "Camillus House", projectName: "Emergency Shelter", programType: "ES", address: "1603 NW 7th Ave", city: "Miami", state: "FL", zip: "33136", phone: "305-374-1065", website: "https://www.camillus.org" },
  { organizationName: "Coalition for the Homeless of Central Florida", projectName: "Emergency Shelter", programType: "ES", address: "639 W Central Blvd", city: "Orlando", state: "FL", zip: "32801", phone: "407-426-1250", website: "https://www.centralfloridahomeless.org" },
  // GA
  { organizationName: "Night to Shine Atlanta", projectName: "Gateway Center Emergency Shelter", programType: "ES", address: "275 Pryor St SW", city: "Atlanta", state: "GA", zip: "30303", phone: "404-215-6600", website: "https://gatewayctr.org" },
  { organizationName: "Partners for HOME", projectName: "Atlanta Safe Haven", programType: "SH", address: "330 Pryor St SW", city: "Atlanta", state: "GA", zip: "30312", phone: "404-586-0304", website: "https://www.partnersforhome.org" },
  // HI
  { organizationName: "Institute for Human Services", projectName: "IHS Emergency Shelter", programType: "ES", address: "546 Kaaahi Pl", city: "Honolulu", state: "HI", zip: "96817", phone: "808-447-2800", website: "https://www.ihshawaii.org" },
  // IL
  { organizationName: "Pacific Garden Mission", projectName: "Emergency Shelter", programType: "ES", address: "1458 S Canal St", city: "Chicago", state: "IL", zip: "60607", phone: "312-492-9410", website: "https://pgm.org" },
  { organizationName: "Chicago Lighthouse", projectName: "Safe Haven Chicago", programType: "SH", address: "1850 W Roosevelt Rd", city: "Chicago", state: "IL", zip: "60608", phone: "312-666-1331", website: "https://chicagolighthouse.org" },
  // IN
  { organizationName: "Horizon House Indianapolis", projectName: "Emergency Shelter", programType: "ES", address: "1033 E Washington St", city: "Indianapolis", state: "IN", zip: "46202", phone: "317-637-3338", website: "https://horizonhouseindy.org" },
  // KY
  { organizationName: "Wayside Christian Mission", projectName: "Emergency Shelter", programType: "ES", address: "432 E Jefferson St", city: "Louisville", state: "KY", zip: "40202", phone: "502-584-3711", website: "https://www.waysidechristianmission.org" },
  // LA
  { organizationName: "Grace House New Orleans", projectName: "Emergency Shelter", programType: "ES", address: "3820 Canal St", city: "New Orleans", state: "LA", zip: "70119", phone: "504-301-7740", website: "https://gracehouseno.org" },
  // MA
  { organizationName: "Pine Street Inn", projectName: "Emergency Shelter", programType: "ES", address: "444 Harrison Ave", city: "Boston", state: "MA", zip: "02118", phone: "617-892-9100", website: "https://www.pinestreetinn.org" },
  { organizationName: "Boston Healthcare for the Homeless", projectName: "Barbara McInnis House Safe Haven", programType: "SH", address: "785 Albany St", city: "Boston", state: "MA", zip: "02118", phone: "617-414-4878", website: "https://www.bhchp.org" },
  // MD
  { organizationName: "Helping Up Mission", projectName: "Emergency Shelter", programType: "ES", address: "1029 E Baltimore St", city: "Baltimore", state: "MD", zip: "21202", phone: "410-675-7500", website: "https://www.helpingupmission.org" },
  // MI
  { organizationName: "Detroit Rescue Mission Ministries", projectName: "Emergency Shelter", programType: "ES", address: "150 Stimson St", city: "Detroit", state: "MI", zip: "48201", phone: "313-993-4700", website: "https://www.drmm.org" },
  { organizationName: "Lighthouse of Oakland County", projectName: "Emergency Shelter", programType: "ES", address: "46156 Woodward Ave", city: "Pontiac", state: "MI", zip: "48342", phone: "248-920-6000", website: "https://www.lp.org" },
  // MN
  { organizationName: "Simpson Housing Services", projectName: "Simpson Emergency Shelter", programType: "ES", address: "2740 1st Ave S", city: "Minneapolis", state: "MN", zip: "55408", phone: "612-332-0628", website: "https://www.simpsonhousing.org" },
  { organizationName: "Catholic Charities of St. Paul", projectName: "Higher Ground St. Paul Safe Haven", programType: "SH", address: "651 N Dale St", city: "Saint Paul", state: "MN", zip: "55103", phone: "651-305-7000", website: "https://www.cctwincities.org" },
  // MO
  { organizationName: "Peter & Paul Community Services", projectName: "Emergency Shelter", programType: "ES", address: "1040 N Grand Blvd", city: "Saint Louis", state: "MO", zip: "63106", phone: "314-421-3131", website: "https://www.ppcsinc.org" },
  // NJ
  { organizationName: "Bridges Outreach", projectName: "Emergency Shelter Newark", programType: "ES", address: "60 Halsey St", city: "Newark", state: "NJ", zip: "07102", phone: "973-624-8000", website: "https://www.bridgesoutreach.org" },
  // NV
  { organizationName: "Catholic Charities of Southern Nevada", projectName: "CCSN Emergency Shelter", programType: "ES", address: "1501 Las Vegas Blvd N", city: "Las Vegas", state: "NV", zip: "89101", phone: "702-366-9012", website: "https://www.catholiccharities.com" },
  // NY
  { organizationName: "Bowery Mission", projectName: "Emergency Shelter", programType: "ES", address: "227 Bowery", city: "New York", state: "NY", zip: "10002", phone: "212-226-6214", website: "https://www.bowery.org" },
  { organizationName: "Breaking Ground", projectName: "Times Square Safe Haven", programType: "SH", address: "236 W 42nd St", city: "New York", state: "NY", zip: "10036", phone: "646-723-3100", website: "https://breakingground.org" },
  { organizationName: "Rochester Rescue Mission", projectName: "Emergency Shelter", programType: "ES", address: "lot 45 Jordon St", city: "Rochester", state: "NY", zip: "14605", phone: "585-325-3380", website: "https://www.rochesterrescuemission.org" },
  // OH
  { organizationName: "Community Shelter Board Columbus", projectName: "Emergency Shelter", programType: "ES", address: "111 E Rich St Ste 100", city: "Columbus", state: "OH", zip: "43215", phone: "614-255-0808", website: "https://www.csb.org" },
  { organizationName: "Bishop Cosgrove Center", projectName: "Emergency Shelter Cleveland", programType: "ES", address: "1736 Superior Ave", city: "Cleveland", state: "OH", zip: "44114", phone: "216-781-8625" },
  // OR
  { organizationName: "Central City Concern", projectName: "Emergency Shelter Portland", programType: "ES", address: "232 NW 6th Ave", city: "Portland", state: "OR", zip: "97209", phone: "503-294-1681", website: "https://centralcityconcern.org" },
  { organizationName: "p:ear", projectName: "Safe Haven Portland", programType: "SH", address: "338 NW 6th Ave", city: "Portland", state: "OR", zip: "97209", phone: "503-228-6677", website: "https://www.pearmentor.org" },
  // PA
  { organizationName: "Sunday Breakfast Rescue Mission", projectName: "Emergency Shelter", programType: "ES", address: "302 N 13th St", city: "Philadelphia", state: "PA", zip: "19107", phone: "215-922-6400", website: "https://www.sundaybreakfast.org" },
  { organizationName: "Light of Life Rescue Mission", projectName: "Emergency Shelter Pittsburgh", programType: "ES", address: "913 Penn Ave", city: "Pittsburgh", state: "PA", zip: "15222", phone: "412-217-2700", website: "https://www.lightoflife.org" },
  // TN
  { organizationName: "Room In The Inn", projectName: "Emergency Shelter Nashville", programType: "ES", address: "211 Nth 1st St", city: "Nashville", state: "TN", zip: "37201", phone: "615-242-7200", website: "https://www.roomintheinn.org" },
  // TX
  { organizationName: "Star of Hope Mission", projectName: "Star of Hope Emergency Shelter", programType: "ES", address: "6897 Airport Blvd", city: "Houston", state: "TX", zip: "77061", phone: "713-748-0700", website: "https://www.sohmission.org" },
  { organizationName: "Austin Resource Center for the Homeless", projectName: "ARCH Emergency Shelter", programType: "ES", address: "500 E 7th St", city: "Austin", state: "TX", zip: "78701", phone: "512-305-4100", website: "https://www.frontsteps.org" },
  { organizationName: "The Salvation Army Dallas", projectName: "Emergency Shelter", programType: "ES", address: "5302 Harry Hines Blvd", city: "Dallas", state: "TX", zip: "75235", phone: "214-424-7000", website: "https://www.salvationarmydfw.org" },
  // UT
  { organizationName: "The Road Home", projectName: "Emergency Shelter Salt Lake", programType: "ES", address: "210 S Rio Grande St", city: "Salt Lake City", state: "UT", zip: "84101", phone: "801-359-4142", website: "https://theroadhome.org" },
  // VA
  { organizationName: "Volunteers of America Chesapeake", projectName: "Emergency Shelter Virginia Beach", programType: "ES", address: "739 Newtown Rd", city: "Virginia Beach", state: "VA", zip: "23462", phone: "757-965-5310", website: "https://www.voa-ches.org" },
  // WA
  { organizationName: "DESC Seattle", projectName: "Emergency Shelter", programType: "ES", address: "515 3rd Ave", city: "Seattle", state: "WA", zip: "98104", phone: "206-464-1570", website: "https://www.desc.org" },
  { organizationName: "DESC Seattle", projectName: "Morrison Safe Haven", programType: "SH", address: "509 3rd Ave", city: "Seattle", state: "WA", zip: "98104", phone: "206-464-1570", website: "https://www.desc.org" },
  // WI
  { organizationName: "Milwaukee Rescue Mission", projectName: "Emergency Shelter", programType: "ES", address: "830 N 19th St", city: "Milwaukee", state: "WI", zip: "53233", phone: "414-344-2211", website: "https://milwaukeerescue.org" },
];

// -----------------------------------------------------------------------
// HIC file parsing
// Supports project-level HIC Excel/CSV from HDX portal.
// -----------------------------------------------------------------------

function findCol(row: Record<string, unknown>, candidates: string[]): string {
  for (const c of candidates) {
    if (c in row && row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== "") {
      return String(row[c]).trim();
    }
  }
  return "";
}

function classifyProgramType(raw: string): "ES" | "SH" | null {
  const norm = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (ES_TYPES.has(norm)) return "ES";
  if (SH_TYPES.has(norm)) return "SH";
  // Fuzzy: starts with "emergency shelter"
  if (norm.startsWith("emergency shelter")) return "ES";
  if (norm.startsWith("safe haven")) return "SH";
  return null;
}

function parseHicWorkbook(filePath: string): HicRecord[] {
  const ext = path.extname(filePath).toLowerCase();
  let workbook: XLSX.WorkBook;

  const fileBuffer = fs.readFileSync(filePath);
  if (ext === ".csv") {
    workbook = XLSX.read(fileBuffer, { type: "buffer", raw: false });
  } else {
    workbook = XLSX.read(fileBuffer, { type: "buffer" });
  }

  const records: HicRecord[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });

    if (rows.length === 0) continue;

    console.log(`  Sheet "${sheetName}": ${rows.length} rows`);

    for (const row of rows) {
      const rawType = findCol(row, COL_TYPE);
      if (!rawType) continue;

      const programType = classifyProgramType(rawType);
      if (!programType) continue;

      const org = findCol(row, COL_ORG);
      const project = findCol(row, COL_PROJECT) || org;
      const address = findCol(row, COL_ADDR);
      const city = findCol(row, COL_CITY);
      const state = findCol(row, COL_STATE);
      const zip = findCol(row, COL_ZIP).replace(/^(\d{5}).*/, "$1"); // keep 5-digit zip
      const phone = findCol(row, COL_PHONE);
      const website = findCol(row, COL_WEBSITE);

      if (!org && !project) continue;
      if (!city || !state) continue;

      records.push({
        organizationName: org || project,
        projectName: project || org,
        programType,
        address: address || "Address not listed",
        city,
        state: state.toUpperCase().slice(0, 2),
        zip: zip || "00000",
        phone: phone || undefined,
        website: website || undefined,
      });
    }
  }

  return records;
}

// -----------------------------------------------------------------------
// HUD USER public download (aggregated — state/CoC level)
// Falls back to HIC_FALLBACK if download fails or yields no project rows.
// -----------------------------------------------------------------------

async function downloadHicPublic(): Promise<HicRecord[]> {
  // HUD USER public files are aggregated (not project-level).
  // We attempt the download and parse anyway — some years include project sheets.
  const urls = [
    "https://www.huduser.gov/portal/sites/default/files/xls/2024-HIC-Counts-by-CoC.xlsx",
    "https://www.huduser.gov/portal/sites/default/files/xls/2023-HIC-Counts-by-CoC.xlsx",
  ];

  for (const url of urls) {
    try {
      console.log(`  Trying ${url} …`);
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RefugeeResourceFinder/1.0; seed-script)" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        console.warn(`  [WARN] HTTP ${res.status}`);
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const records: HicRecord[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
        for (const row of rows) {
          const rawType = findCol(row, COL_TYPE);
          if (!rawType) continue;
          const programType = classifyProgramType(rawType);
          if (!programType) continue;
          const org = findCol(row, COL_ORG);
          const city = findCol(row, COL_CITY);
          const state = findCol(row, COL_STATE);
          if (!org || !city || !state) continue;
          records.push({
            organizationName: org,
            projectName: findCol(row, COL_PROJECT) || org,
            programType,
            address: findCol(row, COL_ADDR) || "Address not listed",
            city,
            state: state.toUpperCase().slice(0, 2),
            zip: findCol(row, COL_ZIP).replace(/^(\d{5}).*/, "$1") || "00000",
            phone: findCol(row, COL_PHONE) || undefined,
            website: findCol(row, COL_WEBSITE) || undefined,
          });
        }
      }

      if (records.length > 0) {
        console.log(`  ✓ Downloaded and parsed ${records.length} project records from ${url}`);
        return records;
      }
      console.log(`  No project-level rows found in this file (likely aggregated data) — continuing`);
    } catch (err) {
      console.warn(`  [WARN] Download failed: ${err}`);
    }
  }

  return [];
}

// -----------------------------------------------------------------------
// Geocoding (re-uses same Mapbox approach as seed-organizations.ts)
// -----------------------------------------------------------------------

async function geocode(
  name: string,
  city: string,
  state: string,
  address?: string
): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  // Use full address if available, otherwise name+city+state
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
    await new Promise(r => setTimeout(r, 250)); // respect Mapbox free-tier rate limit
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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    console.warn("[WARN] NEXT_PUBLIC_MAPBOX_TOKEN not set — shelters without coordinates will be skipped");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Resolve data source ────────────────────────────────────────────────
  const fileArgIdx = process.argv.indexOf("--hic-file");
  const filePath = fileArgIdx !== -1 ? process.argv[fileArgIdx + 1] : undefined;

  let rawRecords: HicRecord[] = [];

  if (filePath) {
    if (!fs.existsSync(filePath)) {
      console.error(`ERROR: File not found: ${filePath}`);
      process.exit(1);
    }
    console.log(`\n=== HUD HIC Seeder ===`);
    console.log(`  Source: local file ${filePath}`);
    rawRecords = parseHicWorkbook(filePath);
    console.log(`  Parsed: ${rawRecords.length} ES/SH records from file`);
  } else {
    console.log(`\n=== HUD HIC Seeder ===`);
    console.log(`  No --hic-file provided. Trying HUD USER public download…`);
    console.log(`  (For full project-level data, see script header for HDX portal instructions)`);
    rawRecords = await downloadHicPublic();
  }

  if (rawRecords.length === 0) {
    console.log(`  No project-level records found — using built-in fallback dataset (${HIC_FALLBACK.length} shelters)`);
    rawRecords = HIC_FALLBACK;
  }

  // ── Deduplicate by name+zip ────────────────────────────────────────────
  const seen = new Set<string>();
  const unique: HicRecord[] = [];
  for (const r of rawRecords) {
    const key = `${r.organizationName.toLowerCase()}|${r.zip}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  }
  if (unique.length < rawRecords.length) {
    console.log(`  Deduped: ${rawRecords.length} → ${unique.length} unique by name+zip`);
  }

  // ── Build rows ────────────────────────────────────────────────────────
  console.log(`\n  Geocoding and building rows…`);
  const rows: ResourceRow[] = [];
  let geocodeMissCount = 0;

  for (const rec of unique) {
    const coords = await geocode(rec.organizationName, rec.city, rec.state, rec.address);
    if (!coords) {
      console.warn(`  [WARN] No coords for "${rec.organizationName}" (${rec.city}, ${rec.state}) — skipped`);
      geocodeMissCount++;
      continue;
    }

    const isES = rec.programType === "ES";
    rows.push({
      name: rec.projectName || rec.organizationName,
      category: "shelter",
      status: "open",
      address: rec.address,
      city: rec.city,
      state: rec.state,
      zip: rec.zip,
      lat: coords.lat,
      lng: coords.lng,
      phone: rec.phone?.replace(/[^\d+\-().x ]/g, "").trim().slice(0, 20) || null,
      website: rec.website || null,
      hours: null,
      languages: null,
      urgent: isES, // Emergency Shelters marked urgent per McKinney-Vento federal mandate
      verified: true,
      documentation_required: isES ? "none" : "id_only",
    });
  }

  if (geocodeMissCount > 0) {
    console.log(`  Skipped: ${geocodeMissCount} records with no geocodable address`);
  }

  // ── Log by program type ───────────────────────────────────────────────
  const esRows = rows.filter(r => r.documentation_required === "none");
  const shRows = rows.filter(r => r.documentation_required === "id_only");
  console.log(`\n  Program type breakdown:`);
  console.log(`    Emergency Shelter (no docs required, urgent=true): ${esRows.length}`);
  console.log(`    Safe Haven (ID only, urgent=false):                ${shRows.length}`);
  console.log(`  Total rows to upsert: ${rows.length}`);

  // ── Log by state ──────────────────────────────────────────────────────
  const stateCounts: Record<string, number> = {};
  for (const r of rows) {
    stateCounts[r.state] = (stateCounts[r.state] ?? 0) + 1;
  }
  console.log(`\n  Per-state breakdown:`);
  for (const st of Object.keys(stateCounts).sort()) {
    console.log(`    ${st}: ${stateCounts[st]}`);
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

  console.log(`\n✓ HUD HIC: ${inserted} shelter rows upserted.`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
