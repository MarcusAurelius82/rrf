import { NextRequest, NextResponse } from "next/server";
import { ApiResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { texts, target_lang } = await request.json() as { texts: string[]; target_lang: string };

    if (!Array.isArray(texts) || !texts.length || !target_lang) {
      return NextResponse.json<ApiResponse<never>>(
        { error: "texts[] and target_lang required" },
        { status: 400 }
      );
    }

    // DeepL accepts up to 50 texts per request
    const res = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: texts.slice(0, 50), target_lang }),
    });

    if (!res.ok) throw new Error(`DeepL ${res.status}`);
    const json = await res.json() as { translations: Array<{ text: string }> };
    const translations = json.translations.map(t => t.text);

    return NextResponse.json<ApiResponse<{ translations: string[] }>>({ data: { translations } });
  } catch (err) {
    console.error(err);
    return NextResponse.json<ApiResponse<never>>({ error: "Translation failed" }, { status: 500 });
  }
}
