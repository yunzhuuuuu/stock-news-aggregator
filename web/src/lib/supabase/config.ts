/**
 * Environment variables keep project-specific credentials outside source code.
 * NEXT_PUBLIC_ means Next.js may expose the value to browser JavaScript.
 * This is safe for Supabase's publishable key because RLS is the real security
 * boundary; the service_role key must never use NEXT_PUBLIC_.
 */
export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and add your project values.",
    );
  }

  return { url, publishableKey };
}
