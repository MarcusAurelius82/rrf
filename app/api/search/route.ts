import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { searchWithAI } from "@/lib/anthropic";
import { ApiResponse, Resource, ResourceCategory } from "@/types";

// Simple in-memory rate limiter: 10 requests per minute per IP.
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    if (!checkRateLimit(ip)) {
      return NextResponse.json<ApiResponse<never>>(
        { error: "Please wait a moment before searching again." },
        { status: 429 },
      );
    }

    const { query, category, state } = await request.json();
    if (!query?.trim()) {
      return NextResponse.json<ApiResponse<never>>({ error: "Query required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch a candidate pool by location — do NOT use textSearch here.
    // The AI handles semantic matching; the DB just provides the pool.
    // Priority: state filter > US-wide bounds fallback.
    let q = supabase
      .from("resources")
      .select("*")
      .eq("verified", true)
      .order("urgent", { ascending: false })
      .limit(50);

    if (state) {
      q = q.eq("state", state);
    } else {
      // US bounding box fallback when no state is selected
      q = q
        .gte("lat", 24).lte("lat", 49)
        .gte("lng", -125).lte("lng", -66);
    }

    if (category) q = q.eq("category", category as ResourceCategory);

    const { data: dbResources, error } = await q;
    if (error) throw error;

    const candidates = dbResources ?? [];
    const { resources, ai_summary } = await searchWithAI(
      query,
      candidates,
      state ?? null,
      category ?? null,
    );

    return NextResponse.json<ApiResponse<{ resources: Resource[]; ai_summary: string }>>({
      data: { resources, ai_summary },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json<ApiResponse<never>>({ error: "Search failed" }, { status: 500 });
  }
}
