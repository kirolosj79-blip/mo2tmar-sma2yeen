import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

/**
 * Server-side client. Uses the anon key by default so it works out of the box;
 * if you add Supabase Auth / server actions that need elevated access, create a
 * second client here using SUPABASE_SERVICE_ROLE_KEY (never expose that key to the browser).
 */
export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}
