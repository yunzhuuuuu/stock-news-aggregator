import { NextResponse } from "next/server";
import { refreshNewsCache } from "@/lib/news/refresh";
import {
  claimNewsRefresh,
  completeNewsRefresh,
  loadCachedNewsArticles,
  persistNewsArticles,
} from "@/lib/news/storage";
import { createMarketauxProvider } from "@/lib/providers/marketaux";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { defaultHoldingSymbols } from "@/lib/default-holdings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const symbolPattern = /^[A-Z][A-Z0-9.-]{0,5}$/;

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  if (!symbolPattern.test(symbol)) {
    return NextResponse.json({ error: "Use a valid stock symbol." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Signed-in users may spend shared news quota only for a symbol in their
    // own RLS-protected portfolio.
    const { data: position, error: positionError } = await supabase
      .from("positions")
      .select("id")
      .eq("user_id", user.id)
      .eq("symbol", symbol)
      .maybeSingle();
    if (positionError) {
      return NextResponse.json({ error: "Could not verify this holding." }, { status: 500 });
    }
    if (!position) {
      return NextResponse.json(
        { error: "News is available only for symbols in your portfolio." },
        { status: 403 },
      );
    }
  } else if (!defaultHoldingSymbols.has(symbol)) {
    // Guests can explore news for the three public demo holdings without
    // turning this route into an arbitrary-symbol provider proxy.
    return NextResponse.json(
      { error: "Sign in to view news for other portfolio symbols." },
      { status: 403 },
    );
  }

  try {
    const admin = createAdminClient();
    const provider = createMarketauxProvider(process.env.MARKETAUX_API_TOKEN ?? "");
    const result = await refreshNewsCache({
      loadCached: () => loadCachedNewsArticles(admin, symbol),
      claim: () => claimNewsRefresh(admin, symbol),
      fetchArticles: () => provider.fetchArticles([symbol]),
      persist: (articles) => persistNewsArticles(admin, articles),
      complete: (success, error) => completeNewsRefresh(admin, symbol, success, error),
    });

    // The global request count is operational data and is not exposed to users.
    return NextResponse.json({
      articles: result.articles,
      status: result.status,
      message: result.message,
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "The news service is temporarily unavailable." },
      { status: 500 },
    );
  }
}
