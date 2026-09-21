import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

/**
 * This client bypasses RLS and must only be created in server-only code.
 * The service-role key deliberately has no NEXT_PUBLIC_ prefix.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient(getSupabaseConfig().url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
