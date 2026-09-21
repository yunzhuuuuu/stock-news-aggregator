import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

/**
 * Server Components and Server Actions call this function for each request.
 * Supabase stores the signed-in session in cookies, so the server can identify
 * the user before it reads private portfolio rows.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // A Server Component cannot write cookies. proxy.ts refreshes the
          // session, so ignoring this specific write attempt is expected.
        }
      },
    },
  });
}
