import { createAlphaVantageProvider } from "@/lib/providers/alpha-vantage";
import { refreshDailyPrices, type SymbolRefreshResult } from "./refresh";
import { createAdminClient } from "@/lib/supabase/admin";

const freshStatusMilliseconds = 12 * 60 * 60 * 1_000;

export function isRecentPriceStatus(
  checkedAtValue: string | null | undefined,
  now = Date.now(),
) {
  const checkedAt = checkedAtValue ? Date.parse(checkedAtValue) : NaN;
  return Number.isFinite(checkedAt) && now - checkedAt < freshStatusMilliseconds;
}

/** Fetch and persist provider results for an explicit list of symbols. */
export async function refreshAndStoreDailyPrices(
  symbols: string[],
): Promise<SymbolRefreshResult[]> {
  const supabase = createAdminClient();
  const provider = createAlphaVantageProvider(
    process.env.ALPHA_VANTAGE_API_KEY ?? "",
  );
  const results = await refreshDailyPrices(symbols, {
    provider,
    // Alpha Vantage's development tier permits only one request per second.
    waitBetweenSymbols: () => new Promise((resolve) => setTimeout(resolve, 1_200)),
    async upsert(rows) {
      const { error } = await supabase
        .from("daily_prices")
        .upsert(rows, { onConflict: "symbol,trading_date" });
      if (error) throw new Error(error.message);
    },
  });

  const checkedAt = new Date().toISOString();
  const statusRows = results.map((result) => ({
    symbol: result.symbol,
    status: result.status === "updated"
      ? "ok"
      : result.code === "INVALID_SYMBOL"
        ? "invalid_symbol"
        : "temporary_error",
    message: result.status === "updated" ? null : result.error,
    checked_at: checkedAt,
  }));
  if (statusRows.length > 0) {
    const { error } = await supabase
      .from("price_refresh_status")
      .upsert(statusRows, { onConflict: "symbol" });
    if (error) throw new Error(error.message);
  }

  return results;
}

/**
 * Adding the same symbol in another account should reuse the public cache.
 * Only a missing or older status consumes a provider request.
 */
export async function ensureRecentDailyPrice(
  symbol: string,
): Promise<SymbolRefreshResult | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("price_refresh_status")
    .select("checked_at")
    .eq("symbol", symbol)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (isRecentPriceStatus(data?.checked_at ? String(data.checked_at) : null)) {
    return null;
  }

  const [result] = await refreshAndStoreDailyPrices([symbol]);
  return result;
}
