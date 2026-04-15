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

// Pull a location hint from patterns like "food in sf", "shelter near Chicago",
// "legal aid around Boston". Returns the raw location string for geocoding.
function extractLocationHint(query: string): string | null {
  const match = query.match(
    /\b(?:in|near|around|at)\s+([a-z][a-z\s,]{1,30?})(?:\s+that|\s+which|\s+with|\s+for|\s+accept|\s+open|$)/i
  );
  return match ? match[1].trim() : null;
}

// Geocode a location hint to a US state code using the Mapbox Places API.
// Returns e.g. "CA" for "sf", "IL" for "Chicago". Returns null on failure.
async function geocodeToState(hint: string): Promise<string | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(hint)}.json` +
      `?country=US&types=region,place&limit=1&access_token=${token}`;
    const res  = await fetch(url);
    const json = await res.json() as {
      features?: Array<{
        properties?: { short_code?: string };
        context?:    Array<{ id: string; short_code?: string }>;
      }>;
    };
    const feature = json.features?.[0];
    // Direct region result (e.g. "california" → "US-CA")
    if (feature?.properties?.short_code?.startsWith("US-")) {
      return feature.properties.short_code.slice(3);
    }
    // City result — state is in the context array
    const regionCtx = feature?.context?.find(c => c.id.startsWith("region"));
    if (regionCtx?.short_code?.startsWith("US-")) {
      return regionCtx.short_code.slice(3);
    }
  } catch { /* ignore — fall through to broader search */ }
  return null;
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

    // Resolve the best state to scope candidates:
    // 1. Explicit state from the map selection
    // 2. State detected by geocoding a location mention in the query
    // 3. Fall back to US-wide
    let resolvedState: string | null = state ?? null;
    if (!resolvedState) {
      const hint = extractLocationHint(query);
      if (hint) resolvedState = await geocodeToState(hint);
    }

    const supabase = createAdminClient();

    let q = supabase
      .from("resources")
      .select("*")
      .eq("verified", true)
      .order("urgent", { ascending: false })
      .limit(100);

    if (resolvedState) {
      q = q.eq("state", resolvedState);
    } else {
      q = q.gte("lat", 24).lte("lat", 49).gte("lng", -125).lte("lng", -66);
    }

    if (category) q = q.eq("category", category as ResourceCategory);

    const { data: dbResources, error } = await q;
    if (error) throw error;

    const candidates = dbResources ?? [];
    const { resources, ai_summary } = await searchWithAI(
      query,
      candidates,
      resolvedState,
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
