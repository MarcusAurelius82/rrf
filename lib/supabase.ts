import { createClient } from "@supabase/supabase-js";

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder";

function validUrl(raw: string | undefined): string {
  if (!raw) return PLACEHOLDER_URL;
  try { new URL(raw); return raw; } catch { return PLACEHOLDER_URL; }
}

const supabaseUrl = validUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY;

// Browser client (for client components)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server client (for server components / API routes)
export function createServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

// Admin client (for API routes needing elevated access)
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || PLACEHOLDER_KEY;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
