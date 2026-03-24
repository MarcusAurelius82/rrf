import { NextRequest, NextResponse } from "next/server";
import { ApiResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { text, target_lang } = await request.json();
    if (!text || !target_lang) {
      return NextResponse.json<ApiResponse<never>>({ error: "text and target_lang required" }, { status: 400 });
    }

    const res = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: [text], target_lang }),
    });

    if (!res.ok) throw new Error("DeepL API error");
    const json = await res.json();
    const translated_text = json.translations?.[0]?.text ?? text;

    return NextResponse.json<ApiResponse<{ translated_text: string }>>({ data: { translated_text } });
  } catch (err) {
    console.error(err);
    return NextResponse.json<ApiResponse<never>>({ error: "Translation failed" }, { status: 500 });
  }
}
