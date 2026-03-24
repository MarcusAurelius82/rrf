import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { searchWithAI } from "@/lib/anthropic";
import { ApiResponse, ResourceCategory } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { query, state, category } = await request.json();
    if (!query?.trim()) {
      return NextResponse.json<ApiResponse<never>>({ error: "Query required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    let dbQuery = supabase.from("resources").select("*").eq("verified", true);
    if (state) dbQuery = dbQuery.eq("state", state);
    if (category) dbQuery = dbQuery.eq("category", category as ResourceCategory);
    dbQuery = dbQuery.order("urgent", { ascending: false }).limit(100);

    const { data: resources, error } = await dbQuery;
    if (error) throw error;

    const result = await searchWithAI(query, resources ?? [], state, category);
    return NextResponse.json<ApiResponse<typeof result>>({ data: result });
  } catch (err) {
    console.error(err);
    return NextResponse.json<ApiResponse<never>>({ error: "Search failed" }, { status: 500 });
  }
}
