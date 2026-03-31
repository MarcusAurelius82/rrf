import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { ApiResponse, Resource } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state");
    const category = searchParams.get("category");
    const urgentOnly = searchParams.get("urgent_only") === "true";

    const supabase = createAdminClient();

    const baseQuery = () =>
      supabase.from("resources").select("*")
        .eq("verified", true)
        .gte("lat", 24).lte("lat", 49)
        .gte("lng", -125).lte("lng", -66)
        .order("urgent", { ascending: false })
        .order("name");

    let data: Resource[];

    if (category) {
      // Single-category request — return all matching records
      let q = baseQuery().eq("category", category);
      if (state) q = q.eq("state", state);
      if (urgentOnly) q = q.eq("urgent", true);
      const { data: rows, error } = await q;
      if (error) throw error;
      data = rows ?? [];
    } else {
      // No category filter — cap each category at 20 to balance the map
      const CATEGORIES = ["medical", "shelter", "food", "legal", "language"] as const;
      const CAP = 20;

      const results = await Promise.all(
        CATEGORIES.map(cat => {
          let q = baseQuery().eq("category", cat).limit(CAP);
          if (state) q = q.eq("state", state);
          if (urgentOnly) q = q.eq("urgent", true);
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
