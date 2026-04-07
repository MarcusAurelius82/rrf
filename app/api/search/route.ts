import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { ApiResponse, Resource, ResourceCategory } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { query, category } = await request.json();
    if (!query?.trim()) {
      return NextResponse.json<ApiResponse<never>>({ error: "Query required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    let q = supabase
      .from("resources")
      .select("*")
      .eq("verified", true)
      .textSearch("search_vector", query, { type: "websearch", config: "english" })
      .gte("lat", 24).lte("lat", 49)
      .gte("lng", -125).lte("lng", -66)
      .order("urgent", { ascending: false })
      .limit(50);

    if (category) q = q.eq("category", category as ResourceCategory);

    const { data: resources, error } = await q;
    if (error) throw error;

    return NextResponse.json<ApiResponse<{ resources: Resource[] }>>({
      data: { resources: resources ?? [] },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json<ApiResponse<never>>({ error: "Search failed" }, { status: 500 });
  }
}
