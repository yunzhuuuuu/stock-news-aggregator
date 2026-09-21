import type { NextRequest } from "next/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/proxy";

/** Next.js 16 calls this file before matching application routes. */
export async function proxy(request: NextRequest) {
  // Keeping the unconfigured app renderable makes first-time setup clearer.
  if (!hasSupabaseConfig()) return;
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
