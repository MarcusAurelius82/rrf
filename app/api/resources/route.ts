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
    let query = supabase.from("resources").select("*").eq("verified", true);

    if (state) query = query.eq("state", state);
    if (category) query = query.eq("category", category);
    if (urgentOnly) query = query.eq("urgent", true);

    // Exclude records with missing or out-of-US-bounds coordinates
    query = query
      .gte("lat", 24).lte("lat", 49)
      .gte("lng", -125).lte("lng", -66);

    query = query.order("urgent", { ascending: false }).order("name");

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json<ApiResponse<Resource[]>>({ data: data ?? [] });
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
