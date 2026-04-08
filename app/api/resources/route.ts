import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { ApiResponse, Resource } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state      = searchParams.get("state");
    const category   = searchParams.get("category");
    const urgentOnly = searchParams.get("urgent_only") === "true";

    // Viewport bbox — when present, return full fidelity for that area
    const minLat = searchParams.get("min_lat");
    const maxLat = searchParams.get("max_lat");
    const minLng = searchParams.get("min_lng");
    const maxLng = searchParams.get("max_lng");
    const hasBbox = minLat && maxLat && minLng && maxLng;

    const supabase = createAdminClient();

    const baseQuery = () => {
      let q = supabase.from("resources").select("*")
        .eq("verified", true)
        .order("urgent", { ascending: false })
        .order("name");

      if (hasBbox) {
        // Tight viewport bounds — return everything within the box
        q = q
          .gte("lat", parseFloat(minLat!))
          .lte("lat", parseFloat(maxLat!))
          .gte("lng", parseFloat(minLng!))
          .lte("lng", parseFloat(maxLng!));
      } else {
        // Fallback / national view — clamp to US
        q = q.gte("lat", 24).lte("lat", 49).gte("lng", -125).lte("lng", -66);
      }

      return q;
    };

    let data: Resource[];

    if (category) {
      let q = baseQuery().eq("category", category);
      if (state) q = q.eq("state", state);
      if (urgentOnly) q = q.eq("urgent", true);
      // No cap when bbox is set; 500 safety limit for unbounded category queries
      if (!hasBbox) q = q.limit(500);
      const { data: rows, error } = await q;
      if (error) throw error;
      data = rows ?? [];
    } else {
      const CATEGORIES = ["medical", "shelter", "food", "legal", "language"] as const;
      // No cap for viewport queries — return everything in the box.
      // Fallback national view keeps a per-category cap so the initial load is fast.
      const CAP = hasBbox ? null : (state ? 20 : 50);

      const results = await Promise.all(
        CATEGORIES.map(cat => {
          let q = baseQuery().eq("category", cat);
          if (state) q = q.eq("state", state);
          if (urgentOnly) q = q.eq("urgent", true);
          if (CAP !== null) q = q.limit(CAP);
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
