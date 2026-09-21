import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase sends new users back here after they click the email-confirmation
 * link. The one-time token is exchanged for a signed-in cookie session.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const code = request.nextUrl.searchParams.get("code");

  // Build a clean destination so one-time authentication values never remain
  // in the address bar after they have been used.
  const destination = request.nextUrl.clone();
  destination.pathname = "/";
  destination.search = "";

  const supabase = await createClient();

  // A customized Supabase email template sends token_hash + type. Supabase's
  // PKCE redirect flow sends code instead. Supporting both keeps local setup
  // compatible while still exchanging the secret only on the server.
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) return NextResponse.redirect(destination);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(destination);
  }

  destination.searchParams.set(
    "authError",
    "The confirmation link is invalid or expired.",
  );
  return NextResponse.redirect(destination);
}
