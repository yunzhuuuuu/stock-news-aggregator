import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { refreshAndStoreDailyPrices } from "@/lib/prices/refresh-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.PRICE_REFRESH_SECRET ?? process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || !supplied) return false;

  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes);
}

async function handleRefresh(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data: positionRows, error: positionError } = await supabase
      .from("positions")
      .select("symbol");
    if (positionError) throw new Error(positionError.message);

    const symbols = (positionRows ?? []).map((row) => String(row.symbol));
    const results = await refreshAndStoreDailyPrices(symbols);

    const updated = results.filter((result) => result.status === "updated").length;
    const failed = results.length - updated;
    return NextResponse.json(
      { symbols: results.length, updated, failed, results },
      { status: failed > 0 ? 207 : 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Price refresh failed." },
      { status: 500 },
    );
  }
}

// POST is convenient for a manual local check. GET also supports a future
// Vercel Cron call, which supplies the same Authorization bearer secret.
export const POST = handleRefresh;
export const GET = handleRefresh;
