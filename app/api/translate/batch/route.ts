import { NextRequest, NextResponse } from "next/server";
import { ApiResponse } from "@/types";

export async function POST(request: NextRequest) {
  let texts: string[] = [];

  try {
    const body = await request.json() as { texts: string[]; target_lang: string };
    texts = Array.isArray(body.texts) ? body.texts : [];
    const { target_lang } = body;

    if (!texts.length || !target_lang) {
      return NextResponse.json<ApiResponse<never>>(
        { error: "texts[] and target_lang required" },
        { status: 400 }
      );
    }

    // If no API key, return originals so the UI degrades gracefully
    if (!process.env.DEEPL_API_KEY) {
      console.warn("[translate/batch] DEEPL_API_KEY not set — returning originals");
      return NextResponse.json<ApiResponse<{ translations: string[] }>>({
        data: { translations: texts },
      });
    }

    const res = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: texts.slice(0, 50), target_lang }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[translate/batch] DeepL ${res.status}: ${errBody}`);
      // Graceful degradation — return originals rather than a 500
      return NextResponse.json<ApiResponse<{ translations: string[] }>>({
        data: { translations: texts },
      });
    }

    const json = await res.json() as { translations: Array<{ text: string }> };
    return NextResponse.json<ApiResponse<{ translations: string[] }>>({
      data: { translations: json.translations.map(t => t.text) },
    });
  } catch (err) {
    console.error("[translate/batch]", err);
    // Always return originals — never a 500 to the client
    return NextResponse.json<ApiResponse<{ translations: string[] }>>({
      data: { translations: texts },
    });
  }
}
