/**
 * Generates static UI translations for all supported languages via DeepL.
 * Run once (or after any UI_STRINGS change) and commit the output.
 *
 * Usage:
 *   npx ts-node -e "require('dotenv').config({path:'.env.local'})" scripts/generate-ui-translations.ts
 *   — or —
 *   npm run generate:translations
 */

import * as fs from "fs";
import * as path from "path";
import { UI_STRINGS, UIKey } from "../lib/ui-strings";
import { SUPPORTED_LANGUAGES } from "../lib/deepl";

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const OUT_PATH = path.resolve(__dirname, "../lib/ui-translations.json");
const DEEPL_URL = "https://api-free.deepl.com/v2/translate";

// DeepL free tier allows 50 texts per request — our ~40 strings fit in one call per language.
async function translateBatch(texts: string[], targetLang: string): Promise<string[]> {
  const res = await fetch(DEEPL_URL, {
    method: "POST",
    headers: {
      "Authorization": `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: texts, target_lang: targetLang }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DeepL ${res.status} for ${targetLang}: ${body}`);
  }

  const json = await res.json() as { translations: Array<{ text: string }> };
  return json.translations.map((t) => t.text);
}

async function main() {
  if (!DEEPL_API_KEY) {
    console.error("Error: DEEPL_API_KEY is not set. Add it to .env.local and try again.");
    process.exit(1);
  }

  const keys = Object.keys(UI_STRINGS) as UIKey[];
  const texts = keys.map((k) => UI_STRINGS[k]);

  // Load existing output so we can skip already-translated languages on re-runs
  let existing: Record<string, Record<string, string>> = {};
  if (fs.existsSync(OUT_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(OUT_PATH, "utf-8"));
    } catch {
      // Start fresh if file is malformed
    }
  }

  const result: Record<string, Record<string, string>> = { ...existing };

  for (const lang of SUPPORTED_LANGUAGES) {
    if (result[lang.code] && Object.keys(result[lang.code]).length === keys.length) {
      console.log(`  ${lang.code} — already complete, skipping`);
      continue;
    }

    process.stdout.write(`  ${lang.code} (${lang.label})... `);
    try {
      const translated = await translateBatch(texts, lang.deeplCode);
      result[lang.code] = {};
      keys.forEach((k, i) => {
        result[lang.code][k] = translated[i] ?? UI_STRINGS[k];
      });
      console.log("✓");
    } catch (err) {
      console.error(`FAILED — ${err}`);
      // Keep existing data for this language if available
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + "\n");
  const langCount = Object.keys(result).length;
  console.log(`\nSaved ${langCount} language(s) → ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
