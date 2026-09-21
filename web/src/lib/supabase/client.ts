import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

/** Use this only from Client Components that need direct browser access. */
export function createClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient(url, publishableKey);
}
