import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { ApiResponse, Resource } from "@/types";

// Per-category viewport cap — keeps the map balanced when one category
// (typically medical via HRSA) has far more records than others.
// Resources are ordered by priority DESC so the most refugee-relevant
// ones are always returned first when the cap kicks in.
const VIEWPORT_CAP: Record<string, number> = {
  medical:  100,
  shelter:  200,
  food:     200,
  legal:    200,
  language: 200,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state      = searchParams.get("state");
    const category   = searchParams.get("category");
    const urgentOnly = searchParams.get("urgent_only") === "true";

    // Viewport bbox — when present, return full-fidelity data for that area
    const minLat = searchParams.get("min_lat");
    const maxLat = searchParams.get("max_lat");
    const minLng = searchParams.get("min_lng");
    const maxLng = searchParams.get("max_lng");
    const hasBbox = minLat && maxLat && minLng && maxLng;

    // Treat a bbox wider than ~55° longitude as "national overview" and apply
    // a tight cap — no need to pull hundreds of rows when the map is zoomed out
    // to show the whole country. State-level or city-level views get the full cap.
    const bboxWidthDeg = hasBbox ? parseFloat(maxLng!) - parseFloat(minLng!) : 0;
    const isNationalView = !hasBbox || bboxWidthDeg > 55;

    const supabase = createAdminClient();

    const baseQuery = (cat?: string) => {
      let q = supabase.from("resources").select("*")
        .eq("verified", true)
        .order("urgent",   { ascending: false })
        .order("priority", { ascending: false })
        .order("name");

      if (hasBbox) {
        q = q
          .gte("lat", parseFloat(minLat!))
          .lte("lat", parseFloat(maxLat!))
          .gte("lng", parseFloat(minLng!))
          .lte("lng", parseFloat(maxLng!));
      } else {
        // Fallback / national overview — clamp to US extents
        q = q.gte("lat", 24).lte("lat", 49).gte("lng", -125).lte("lng", -66);
      }

      // Apply per-category cap. National view gets a tight cap (20/cat) since
      // zoomed-out markers all cluster anyway — no point fetching 1000 rows.
      if (cat) {
        q = q.limit(isNationalView ? 20 : (VIEWPORT_CAP[cat] ?? 200));
      }

      return q;
    };

    let data: Resource[];

    if (category) {
      let q = baseQuery(category).eq("category", category);
      if (state) q = q.eq("state", state);
      if (urgentOnly) q = q.eq("urgent", true);
      // National (no bbox) single-category: no cap — return everything
      if (!hasBbox) q = q.limit(1000);
      const { data: rows, error } = await q;
      if (error) throw error;
      data = rows ?? [];
    } else {
      const CATEGORIES = ["medical", "shelter", "food", "legal", "language"] as const;
      // National fallback cap: tight when zoomed out, generous when state is selected
      const NATIONAL_CAP = isNationalView ? 50 : (state ? 50 : 20);

      const results = await Promise.all(
        CATEGORIES.map(cat => {
          let q = baseQuery(cat).eq("category", cat);
          if (state) q = q.eq("state", state);
          if (urgentOnly) q = q.eq("urgent", true);
          if (!hasBbox) q = q.limit(NATIONAL_CAP);
          return q;
        })
      );

      const firstError = results.find(r => r.error)?.error;
      if (firstError) throw firstError;

      data = results.flatMap(r => r.data ?? []);
    }

    return NextResponse.json<ApiResponse<Resource[]>>({ data });
  } catch (err) {
    console.error(err);
    return NextResponse.json<ApiResponse<never>>({ error: "Failed to fetch resources" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("resources")
      .insert({ ...body, verified: false })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json<ApiResponse<Resource>>({ data }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json<ApiResponse<never>>({ error: "Failed to create resource" }, { status: 500 });
  }
}
